import { createZGComputeNetworkBroker, type ZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import type { JsonRpcSigner } from "ethers";

// 0G Testnet RPC and chain
export const ZG_RPC = "https://evmrpc-testnet.0g.ai";
export const ZG_TESTNET_CHAIN_ID = 16602n;

// Cache broker per signer address so we don't reinitialise on every call
const brokerCache = new Map<string, Promise<ZGComputeNetworkBroker>>();

export async function getBroker(signer: JsonRpcSigner): Promise<ZGComputeNetworkBroker> {
  const address = await signer.getAddress();
  if (!brokerCache.has(address)) {
    brokerCache.set(address, createZGComputeNetworkBroker(signer));
  }
  return brokerCache.get(address)!;
}

export function clearBrokerCache(address?: string) {
  if (address) brokerCache.delete(address);
  else brokerCache.clear();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call an AI provider on the 0G Compute Network.
 * The user's wallet signs the payment — no operator API key needed.
 *
 * @param signer - ethers JsonRpcSigner from the connected wallet
 * @param providerAddress - 0G provider contract address
 * @param messages - OpenAI-style message array
 * @param onChunk - called for each streaming token (if supported)
 */
export async function zgChat(
  signer: JsonRpcSigner,
  providerAddress: string,
  messages: ChatMessage[],
  onChunk?: (token: string) => void
): Promise<string> {
  const broker = await getBroker(signer);
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
  const headers = await broker.inference.getRequestHeaders(providerAddress);

  console.log("[0G] endpoint:", endpoint, "model:", model);

  const post = (stream: boolean) =>
    fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ model, messages, stream }),
    });

  let res = await post(typeof onChunk === "function");

  // Some providers don't support streaming — retry without it
  if (!res.ok && res.status === 400 && typeof onChunk === "function") {
    res = await post(false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`0G provider error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isStream = contentType.includes("text/event-stream") || contentType.includes("text/plain");

  console.log("[0G] content-type:", contentType, "isStream:", isStream, "hasOnChunk:", typeof onChunk === "function");

  if (isStream && res.body) {
    // Handle SSE streaming — provider may return text/plain SSE even when stream:false is requested
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (!value) continue;

      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        const trimmed = line.replace(/^data:\s*/, "").trim();
        if (!trimmed || trimmed === "[DONE]") continue;
        try {
          const json = JSON.parse(trimmed);
          const token = json.choices?.[0]?.delta?.content ?? "";
          if (token) { fullText += token; onChunk?.(token); }
        } catch { /* malformed SSE line */ }
      }
    }

    console.log("[0G] streaming response fullText length:", fullText.length, "preview:", fullText.slice(0, 100));
    const chatId = res.headers.get("ZG-Res-Key") ?? "";
    // Fire and forget — don't block returning content on on-chain settlement
    broker.inference.processResponse(providerAddress, chatId, JSON.stringify({ text: fullText })).catch((e) => console.warn("[0G] processResponse error:", e));
    return fullText;
  }

  // Non-streaming JSON response
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  console.log("[0G] json response content length:", content.length, "preview:", content.slice(0, 100));
  if (onChunk && content) onChunk(content);
  const chatId = res.headers.get("ZG-Res-Key") ?? data.id ?? "";
  // Fire and forget — don't block returning content on on-chain settlement
  broker.inference.processResponse(providerAddress, chatId, JSON.stringify(data.usage ?? {})).catch((e) => console.warn("[0G] processResponse error:", e));
  return content;
}

export function isSubAccountError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err);
  return (
    msg.includes("Sub-account not found") ||
    msg.includes("insufficient balance") ||
    msg.includes("locked balance") ||
    msg.includes("minimum reserve")
  );
}

// 100 Gwei in neuron — high enough to replace any stuck mempool tx on testnet
const SETUP_GAS_PRICE = 100_000_000_000;

export interface LedgerInfo {
  exists: boolean;
  /** Free (unallocated) balance in OG */
  freeOG: number;
  /** Total ledger balance in OG */
  totalOG: number;
}

/**
 * Read the user's 0G ledger state without any transactions.
 * Returns exists=false when no ledger has been created yet.
 */
export async function getLedgerInfo(signer: JsonRpcSigner): Promise<LedgerInfo> {
  const broker = await getBroker(signer);
  try {
    const ledger = await broker.ledger.getLedger();
    // balance fields are in neuron (1e18 = 1 OG) — handle both bigint and number
    const toOG = (v: unknown) => Number(BigInt(String(v ?? 0))) / 1e18;
    // The SDK may expose balance, freeBalance, totalBalance — try all shapes
    const total = toOG((ledger as any).balance ?? (ledger as any).totalBalance ?? 0);
    const free  = toOG((ledger as any).freeBalance ?? (ledger as any).balance ?? 0);
    return { exists: true, freeOG: free, totalOG: total };
  } catch {
    return { exists: false, freeOG: 0, totalOG: 0 };
  }
}

/**
 * Top-up ONLY: transfers OG from the existing ledger to the provider sub-account.
 * Use when the ledger already exists but the sub-account is underfunded.
 * Single MetaMask confirmation.
 */
export async function topUpSubAccount(
  signer: JsonRpcSigner,
  providerAddress: string,
  onStep?: (msg: string) => void,
  transferOG = 1
): Promise<void> {
  const broker = await getBroker(signer);
  onStep?.("Transferring to provider sub-account — confirm in MetaMask");
  const transferNeuron = BigInt(Math.round(transferOG * 1e18));
  await broker.ledger.transferFund(providerAddress, "inference", transferNeuron, SETUP_GAS_PRICE);
  onStep?.("Done");
  const address = await signer.getAddress();
  clearBrokerCache(address);
}

/**
 * Full setup: creates the ledger (or deposits more OG) then transfers to the sub-account.
 * Use when no ledger exists at all. Two MetaMask confirmations.
 *
 * @param amountOG   - OG tokens to add to ledger (default 4)
 * @param transferOG - OG tokens to route to the provider sub-account (default 1)
 */
export async function setupSubAccount(
  signer: JsonRpcSigner,
  providerAddress: string,
  onStep?: (msg: string) => void,
  amountOG = 4,
  transferOG = 1
): Promise<void> {
  const broker = await getBroker(signer);

  onStep?.("Checking ledger…");
  const info = await getLedgerInfo(signer);

  if (info.exists) {
    // Ledger found — just top-up the sub-account (no ledger deposit needed)
    await topUpSubAccount(signer, providerAddress, onStep, transferOG);
    return;
  }

  // No ledger at all — create it and then fund the sub-account
  onStep?.("Creating ledger — confirm in MetaMask (1/2)");
  await broker.ledger.addLedger(amountOG, SETUP_GAS_PRICE);

  onStep?.("Funding provider sub-account — confirm in MetaMask (2/2)");
  const transferNeuron = BigInt(Math.round(transferOG * 1e18));
  await broker.ledger.transferFund(providerAddress, "inference", transferNeuron, SETUP_GAS_PRICE);

  onStep?.("Done");
  const address = await signer.getAddress();
  clearBrokerCache(address);
}

/**
 * Classify user intent using 0G AI — runs entirely client-side, paid by the user's wallet.
 */
export async function zgClassifyIntent(
  signer: JsonRpcSigner,
  providerAddress: string,
  prompt: string
): Promise<{ intent: "BUILD_APP" | "ON_CHAIN_TX" | "GENERAL_CHAT"; parameters: Record<string, any> }> {
  const content = await zgChat(signer, providerAddress, [
    {
      role: "system",
      content: `You are the core Planner for Moringa AI OS. Classify the user intent into one of three categories: "BUILD_APP", "ON_CHAIN_TX", or "GENERAL_CHAT". Extract relevant parameters. Respond ONLY with valid JSON: { "intent": "BUILD_APP" | "ON_CHAIN_TX" | "GENERAL_CHAT", "parameters": {} }`,
    },
    { role: "user", content: prompt },
  ]);

  try {
    const parsed = JSON.parse(content);
    return { intent: parsed.intent, parameters: parsed.parameters ?? {} };
  } catch {
    return { intent: "GENERAL_CHAT", parameters: { message: prompt } };
  }
}

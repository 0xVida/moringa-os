"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Loader2,
  AlertCircle,
  X,
  Send,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { ZG_RPC, ZG_TESTNET_CHAIN_ID, zgChat, isSubAccountError } from "@/lib/zerog";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { formatEther, parseEther, getAddress } from "ethers";

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchOGBalance(address: string): Promise<string> {
  const res = await fetch(ZG_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const { result } = await res.json();
  return formatEther(BigInt(result));
}

// ── Tx intent types ────────────────────────────────────────────────────────────

interface ParsedTx {
  type: "send";
  to: string;
  amount: string;
  amountWei: bigint;
  token: string;
  rawCmd: string;
}

const TX_SYSTEM_PROMPT = `You are a Web3 transaction parser. The user describes what they want to do with their crypto wallet in natural language.

Extract the transaction and respond with ONLY valid JSON. No explanation, no markdown.

Format:
{"type":"send","to":"<address or ENS>","amount":"<number>","token":"<OG|ETH>"}

Rules:
- "OG" is the native token on 0G Newton Testnet. Default to OG if token is unclear.
- amount must be a plain decimal number string, e.g. "0.05" or "1.5".
- to must be the full address (0x…) or an ENS name.
- If the intent cannot be parsed, respond: {"error":"<reason>"}`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TxHistoryEntry {
  hash: string;
  amount: string;
  token: string;
  to: string;
  ts: number;
}

// ── Tx confirmation popup ──────────────────────────────────────────────────────

function TxConfirmCard({
  tx,
  onConfirm,
  onDismiss,
  loading,
  confirmed,
  error,
  txHash,
}: {
  tx: ParsedTx;
  onConfirm: () => void;
  onDismiss: () => void;
  loading: boolean;
  confirmed: boolean;
  error: string | null;
  txHash: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm surface border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-up">

        {confirmed && txHash ? (
          /* ── Success / celebration ── */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="relative">
              <div className="size-20 rounded-full bg-lime/20 border border-lime/30 flex items-center justify-center">
                <Check className="size-9 text-lime" strokeWidth={2.5} />
              </div>
              <Sparkles className="absolute -top-1 -right-1 size-5 text-lime animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-2xl text-lime">Confirmed!</p>
              <p className="text-sm text-muted-foreground">
                Sent <span className="text-foreground font-mono">{tx.amount} {tx.token}</span>
              </p>
            </div>
            <a
              href={`https://testnet.0gscan.ai/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-lime hover:underline"
            >
              <ExternalLink className="size-3" />
              {txHash.slice(0, 20)}…
            </a>
            <p className="font-mono text-[10px] text-muted-foreground animate-pulse">Closing…</p>
          </div>
        ) : (
          /* ── Normal confirm view ── */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Confirm Transaction</p>
              <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition">
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-xl bg-white/5 divide-y divide-white/5 text-sm">
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground">Action</span>
                <span className="font-mono uppercase">Send</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono text-lime">{tx.amount} {tx.token}</span>
              </div>
              <div className="flex justify-between px-4 py-3 gap-4">
                <span className="text-muted-foreground shrink-0">To</span>
                <span className="font-mono text-xs break-all text-right">{tx.to}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-xs rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2">
                <AlertCircle className="size-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onDismiss}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl surface font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-lime font-mono text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="size-3 animate-spin" /> Sending…</>
                  : <><Send className="size-3" /> Approve &amp; Send</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main wallet content ────────────────────────────────────────────────────────

function WalletPageContent() {
  const searchParams = useSearchParams();
  const p = searchParams.get("p");
  const { signer, address, chainId } = useWallet();

  const [cmd, setCmd] = useState(p ?? "");
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [providerAddress, setProviderAddress] = useState<string | null>(null);

  // Tx flow state
  const [parsedTx, setParsedTx] = useState<ParsedTx | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txConfirmed, setTxConfirmed] = useState(false);
  const [txHistory, setTxHistory] = useState<TxHistoryEntry[]>([]);

  const isOnZeroG = chainId === ZG_TESTNET_CHAIN_ID;

  const txHistoryKey = address ? `moringa:tx:${address.toLowerCase()}` : null;

  // Load persisted tx history when address is known
  useEffect(() => {
    if (!txHistoryKey) return;
    try {
      const stored = localStorage.getItem(txHistoryKey);
      if (stored) setTxHistory(JSON.parse(stored));
    } catch {}
  }, [txHistoryKey]);

  // Load OG balance
  const refreshBalance = useCallback(async () => {
    if (!address || !isOnZeroG) return;
    setBalanceLoading(true);
    try {
      const bal = await fetchOGBalance(address);
      setBalance(parseFloat(bal).toFixed(4));
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [address, isOnZeroG]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Resolve 0G inference provider once
  useEffect(() => {
    let cancelled = false;
    createZGComputeNetworkReadOnlyBroker(ZG_RPC)
      .then((ro) => ro.inference.listService())
      .then((services) => { if (!cancelled && services.length > 0) setProviderAddress(services[0].provider); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Use 0G AI to parse natural-language command into a structured tx
  const handleExecute = async () => {
    if (!cmd.trim()) return;
    setParseError(null);
    setIsGenerating(true);

    try {
      if (!signer || !providerAddress) {
        setParseError("Connect your wallet and wait for AI provider to load.");
        return;
      }

      const raw = await zgChat(signer, providerAddress, [
        { role: "system", content: TX_SYSTEM_PROMPT },
        { role: "user", content: cmd },
      ]);

      console.log("[wallet] zgChat raw:", JSON.stringify(raw));

      let parsed: any;
      try {
        // Extract first JSON object — handles markdown fences and leading prose
        const stripped = raw.replace(/```json|```/g, "");
        const match = stripped.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("no JSON found");
        parsed = JSON.parse(match[0]);
      } catch {
        setParseError("AI returned an unexpected response. Try rephrasing your command.");
        return;
      }

      if (parsed.error) { setParseError(parsed.error); return; }
      if (!parsed.to || !parsed.amount) { setParseError("AI couldn’t extract a recipient or amount. Try again."); return; }

      let normalizedTo: string;
      try {
        // getAddress normalises any valid hex address to EIP-55 checksum form
        normalizedTo = getAddress(parsed.to);
      } catch { setParseError(`Invalid address: ${parsed.to}`); return; }

      let amountWei: bigint;
      try { amountWei = parseEther(String(parsed.amount)); } catch { setParseError("Invalid amount in AI response."); return; }

      setParsedTx({
        type: "send",
        to: normalizedTo,
        amount: String(parsed.amount),
        amountWei,
        token: (parsed.token ?? "OG").toUpperCase(),
        rawCmd: cmd,
      });
      setTxError(null);
      setTxHash(null);
    } catch (err: any) {
      console.error("[wallet] handleExecute error:", err);
      if (isSubAccountError(err)) {
        setParseError("Your 0G sub-account needs funding. Go to the chat tab to set it up.");
      } else {
        setParseError(err?.message || "AI parsing failed. Check the browser console for details.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDismiss = useCallback(() => {
    setParsedTx(null);
    setTxError(null);
    setTxHash(null);
    setTxConfirmed(false);
  }, []);

  const handleConfirm = async () => {
    if (!parsedTx || !signer) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const tx = await signer.sendTransaction({
        to: parsedTx.to,
        value: parsedTx.amountWei,
      });
      setTxHash(tx.hash);
      await tx.wait();
      // Confirmed on-chain — celebrate then auto-close
      setTxConfirmed(true);
      const newEntry: TxHistoryEntry = { hash: tx.hash, amount: parsedTx.amount, token: parsedTx.token, to: parsedTx.to, ts: Date.now() };
      setTxHistory((prev) => {
        const next = [newEntry, ...prev];
        if (txHistoryKey) {
          try { localStorage.setItem(txHistoryKey, JSON.stringify(next)); } catch {}
        }
        return next;
      });
      refreshBalance();
      setTimeout(handleDismiss, 2500);
    } catch (err: any) {
      setTxError(err?.message ?? "Transaction failed");
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <>
    {parsedTx && (
      <TxConfirmCard
        tx={parsedTx}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
        loading={txLoading}
        confirmed={txConfirmed}
        error={txError}
        txHash={txHash}
      />
    )}
    <div className="space-y-8">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          wallet / overview
        </span>
        <span className="h-px flex-1 bg-white/10" />
        {address && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Balance card */}
        <div className="lg:col-span-3 surface-raised rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 size-64 rounded-full bg-lime/10 blur-3xl pointer-events-none" />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {isOnZeroG ? "balance · 0G Newton Testnet" : "balance"}
          </div>

          {!address ? (
            <div className="mt-6 text-muted-foreground text-sm">Connect your wallet to see your balance.</div>
          ) : !isOnZeroG ? (
            <div className="mt-6 text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="size-4" /> Switch to 0G Newton Testnet to view your OG balance.
            </div>
          ) : (
            <>
              <div className="mt-3 font-display text-5xl sm:text-7xl tracking-tighter leading-none">
                {balanceLoading ? (
                  <span className="text-muted-foreground text-4xl">…</span>
                ) : balance !== null ? (
                  <>{balance}<span className="text-muted-foreground text-3xl ml-2">OG</span></>
                ) : (
                  <span className="text-muted-foreground text-2xl">—</span>
                )}
              </div>
              <div className="mt-4 font-mono text-xs text-muted-foreground break-all">{address}</div>
            </>
          )}
        </div>

        {/* AI command */}
        <div className="lg:col-span-2 surface rounded-2xl p-5 sm:p-6 flex flex-col">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            <span className="size-1.5 rounded-full bg-lime animate-pulse-dot" />
            natural language tx
          </div>
          <textarea
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleExecute(); } }}
            placeholder={'send 1 OG to 0x1234…abcd'}
            rows={3}
            className="w-full bg-background/40 border border-white/5 rounded-xl px-3 py-2 text-sm outline-none focus:border-lime/40 transition resize-none font-body"
          />
          {parseError && (
            <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-rose-400 text-xs">
              <AlertCircle className="size-3 mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
          <button
            onClick={handleExecute}
            disabled={!address || !isOnZeroG || isGenerating || !providerAddress}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lime py-2.5 font-mono text-xs uppercase tracking-widest text-primary-foreground transition hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating
              ? <><Loader2 className="size-3.5 animate-spin" /> parsing with 0G AI…</>
              : <><Send className="size-3.5" /> generate tx</>}
          </button>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground text-center">
            {!providerAddress
              ? "loading 0G AI provider…"
              : "0G AI parses your intent → you review → approve in wallet"}
          </p>
        </div>
      </div>

      {/* Portfolio + Activity — single unified card */}
      <div className="surface rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-white/5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            portfolio &amp; activity
          </span>
          {address && isOnZeroG && (
            <button
              onClick={refreshBalance}
              className="font-mono text-[10px] text-muted-foreground/50 hover:text-foreground transition"
            >
              refresh
            </button>
          )}
        </div>

        {/* OG asset row */}
        <div className="px-3 py-2 border-b border-white/5">
          {!address ? (
            <p className="px-2 py-3 text-xs text-muted-foreground/60">Connect wallet to view assets.</p>
          ) : !isOnZeroG ? (
            <p className="px-2 py-3 text-xs text-amber-400 flex items-center gap-2">
              <AlertCircle className="size-3.5 shrink-0" /> Switch to 0G Newton Testnet.
            </p>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/[0.03] transition">
              <div className="size-9 rounded-full bg-lime/10 grid place-items-center font-mono text-[10px] shrink-0 text-lime font-bold">OG</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">0G Token</p>
                <p className="font-mono text-[10px] text-muted-foreground">0G Newton Testnet</p>
              </div>
              <p className="font-mono text-sm shrink-0">
                {balanceLoading ? <span className="text-muted-foreground">…</span> : <>{balance ?? "—"} <span className="text-muted-foreground text-xs">OG</span></>}
              </p>
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div className="px-3 py-3">
          <p className="px-2 mb-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
            Recent transactions
          </p>
          {txHistory.length > 0 ? (
            <div className="space-y-0.5">
              {txHistory.slice(0, 8).map((t) => (
                <div key={t.hash} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/[0.03] transition group">
                  <div className="size-8 rounded-full bg-lime/10 grid place-items-center shrink-0">
                    <ArrowUpRight className="size-3.5 text-lime" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">Sent {t.amount} <span className="text-muted-foreground">{t.token}</span></p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {t.to.slice(0, 8)}…{t.to.slice(-6)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <a
                      href={`https://testnet.0gscan.ai/tx/${t.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-lime hover:underline flex items-center gap-1 justify-end"
                    >
                      <ExternalLink className="size-2.5" /> view
                    </a>
                    <p className="font-mono text-[10px] text-muted-foreground/50">
                      {new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/40 text-center py-6">
              No transactions yet. Use the AI command above to send OG.
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="font-mono text-xs text-muted-foreground">Loading wallet…</div>}>
      <WalletPageContent />
    </Suspense>
  );
}

import { useCallback, useRef } from "react";
import { useWallet } from "@/lib/wallet";
import { zgClassifyIntent, ZG_RPC } from "@/lib/zerog";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";

export type Intent = "BUILD_APP" | "ON_CHAIN_TX" | "GENERAL_CHAT";

export interface IntentResult {
  intent: Intent;
  parameters: Record<string, any>;
  providerAddress?: string;
}

// Simple keyword fallback for guests (no wallet)
function keywordClassify(prompt: string): IntentResult {
  const p = prompt.toLowerCase();
  if (p.includes("build") || p.includes("app") || p.includes("generate") || p.includes("create"))
    return { intent: "BUILD_APP", parameters: { appDescription: prompt } };
  if (p.includes("swap") || p.includes("send") || p.includes("usdc") || p.includes("eth") || p.includes("wallet") || p.includes("transfer"))
    return { intent: "ON_CHAIN_TX", parameters: { rawIntent: prompt } };
  return { intent: "GENERAL_CHAT", parameters: { message: prompt } };
}

export function useIntent() {
  const { signer } = useWallet();
  // Cache the best provider address so we don't list every call
  const providerRef = useRef<string | null>(null);

  const pickProvider = useCallback(async (): Promise<string | null> => {
    if (providerRef.current) return providerRef.current;
    try {
      const ro = await createZGComputeNetworkReadOnlyBroker(ZG_RPC);
      const services = await ro.inference.listService();
      if (services.length === 0) return null;
      providerRef.current = services[0].provider;
      return providerRef.current;
    } catch {
      return null;
    }
  }, []);

  const classify = useCallback(async (prompt: string): Promise<IntentResult> => {
    // No wallet — fall back to keyword routing immediately
    if (!signer) return keywordClassify(prompt);

    const providerAddress = await pickProvider();
    if (!providerAddress) return keywordClassify(prompt);

    try {
      const result = await zgClassifyIntent(signer, providerAddress, prompt);
      return { ...result, providerAddress };
    } catch {
      // If SDK call fails, degrade gracefully
      return keywordClassify(prompt);
    }
  }, [signer, pickProvider]);

  return { classify, hasWallet: !!signer };
}

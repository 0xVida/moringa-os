/**
 * 0G Storage persistence layer.
 *
 * Upload / download arbitrary JSON blobs from the 0G decentralised storage
 * network.  Uses skipTx:true so no MetaMask confirmation is needed — data
 * goes directly to storage nodes without an on-chain Flow submission.
 * The resulting root hash is stored in localStorage keyed by wallet address,
 * giving each user their own persistent pointer to the latest snapshot.
 *
 * Browser-safe:  Indexer.downloadToBlob() is the browser variant; MemData is
 * a pure-JS in-memory file adapter — neither touches `fs`.
 */

import type { JsonRpcSigner } from "ethers";

export const ZG_STORAGE_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";
export const ZG_STORAGE_RPC = "https://evmrpc-testnet.0g.ai";

function rootHashKey(address: string) {
  return `moringa:og:root:${address.toLowerCase()}`;
}

export function getStoredRootHash(address: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(rootHashKey(address));
}

function setStoredRootHash(address: string, rootHash: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(rootHashKey(address), rootHash);
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

async function withProxy<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return fn();

  const originalFetch = window.fetch;
  const OriginalXHR = window.XMLHttpRequest;

  window.fetch = async (input, init) => {
    let urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith("http://")) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(urlStr)}`;
      if (typeof input === "string" || input instanceof URL) {
        input = proxyUrl;
      } else {
        input = new Request(proxyUrl, input);
      }
    }
    return originalFetch(input, init);
  };

  class ProxiedXHR extends OriginalXHR {
    open(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
      const urlStr = url.toString();
      let finalUrl = urlStr;
      if (urlStr.startsWith("http://")) {
        finalUrl = `/api/proxy?url=${encodeURIComponent(urlStr)}`;
      }
      if (async !== undefined) {
        super.open(method, finalUrl, async, user, password);
      } else {
        super.open(method, finalUrl);
      }
    }
  }
  
  window.XMLHttpRequest = ProxiedXHR as any;

  try {
    return await fn();
  } finally {
    window.fetch = originalFetch;
    window.XMLHttpRequest = OriginalXHR;
  }
}

/**
 * Upload any JSON-serialisable value to 0G Storage.
 * Returns the root hash that can be used to retrieve the data later.
 *
 * skipTx:true — skips the on-chain Flow submission so no MetaMask popup
 * appears.  The data lives on storage nodes and is retrievable by root hash.
 */
export async function uploadToZeroGStorage(
  signer: JsonRpcSigner,
  data: unknown
): Promise<string> {
  const { Indexer, MemData } = await import(
    "@0gfoundation/0g-storage-ts-sdk/browser"
  );

  const address = await signer.getAddress();
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const file = new MemData(bytes);

  return withProxy(async () => {
    const indexer = new Indexer(ZG_STORAGE_INDEXER);
    const [result, err] = await indexer.upload(
      file,
      ZG_STORAGE_RPC,
      signer as any,
      {
        skipTx: true,
        skipIfFinalized: true,
        finalityRequired: false,
      }
    );

    if (err) throw err;
    return (result as any).rootHash as string;
  }).then((rootHash) => {
    if (rootHash) setStoredRootHash(address, rootHash);
    return rootHash;
  });
}

/**
 * Download and parse a JSON blob from 0G Storage by its root hash.
 * Uses Indexer.downloadToBlob() which is browser + Node.js safe.
 */
export async function downloadFromZeroGStorage<T>(
  rootHash: string
): Promise<T> {
  return withProxy(async () => {
    const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk/browser");
    const indexer = new Indexer(ZG_STORAGE_INDEXER);
    const [blob, err] = await indexer.downloadToBlob(rootHash);
    if (err) throw err;
    const text = await blob.text();
    return JSON.parse(text) as T;
  });
}

/**
 * Try to load the latest chat history snapshot for a wallet address from
 * 0G Storage.  Returns null if no snapshot exists or the download fails.
 */
export async function loadRemoteChatHistory<T>(
  address: string
): Promise<T | null> {
  const rootHash = getStoredRootHash(address);
  if (!rootHash) return null;
  try {
    return await downloadFromZeroGStorage<T>(rootHash);
  } catch {
    return null;
  }
}

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

  const rootHash = (result as any).rootHash as string;
  if (rootHash) setStoredRootHash(address, rootHash);
  return rootHash;
}

/**
 * Download and parse a JSON blob from 0G Storage by its root hash.
 * Uses Indexer.downloadToBlob() which is browser + Node.js safe.
 */
export async function downloadFromZeroGStorage<T>(
  rootHash: string
): Promise<T> {
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk/browser");
  const indexer = new Indexer(ZG_STORAGE_INDEXER);
  const [blob, err] = await indexer.downloadToBlob(rootHash);
  if (err) throw err;
  const text = await blob.text();
  return JSON.parse(text) as T;
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

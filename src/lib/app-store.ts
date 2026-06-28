import type { AppConfig } from "@/components/app-renderer";
import { uploadToZeroGStorage, downloadFromZeroGStorage } from "./og-storage";
import type { JsonRpcSigner } from "ethers";

export interface SavedApp {
  id: string;
  name: string;
  tag: string;
  config: AppConfig;
  updated_at: number;
}

export interface RawAppStore {
  v: 1;
  apps: SavedApp[];
}

const LS_KEY = "moringa:apps";

function read(): RawAppStore {
  if (typeof window === "undefined") return { v: 1, apps: [] };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.v === 1 ? parsed : { v: 1, apps: parsed.apps ?? [] };
    }
  } catch {
    /* ignore */
  }
  return { v: 1, apps: [] };
}

function write(store: RawAppStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

export async function listSavedApps(): Promise<SavedApp[]> {
  const { apps } = read();
  return [...apps].sort((a, b) => b.updated_at - a.updated_at);
}

export async function saveApp(
  name: string,
  tag: string,
  config: AppConfig
): Promise<SavedApp> {
  const store = read();
  const app: SavedApp = {
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    tag: tag.slice(0, 30),
    config,
    updated_at: Math.floor(Date.now() / 1000),
  };
  
  // Overwrite existing app with the same exact config name/tag to avoid duplicates if user clicks save multiple times?
  // Let's just push it as a new app or update if name matches.
  const existingIdx = store.apps.findIndex(a => a.name === name);
  if (existingIdx >= 0) {
    store.apps[existingIdx] = { ...app, id: store.apps[existingIdx].id };
  } else {
    store.apps.unshift(app);
  }
  
  write(store);
  return app;
}

export async function deleteApp(id: string): Promise<void> {
  const store = read();
  store.apps = store.apps.filter((a) => a.id !== id);
  write(store);
}

export function getRawAppStore(): RawAppStore {
  return read();
}

export function mergeRemoteAppStore(remote: RawAppStore): boolean {
  const local = read();
  const localNewest = Math.max(0, ...local.apps.map((a) => a.updated_at));
  const remoteNewest = Math.max(0, ...remote.apps.map((a) => a.updated_at));
  
  // Basic merge: If remote has newer activity, adopt it.
  if (remoteNewest <= localNewest && local.apps.length >= remote.apps.length) return false;
  
  write(remote);
  return true;
}

// --- 0G Storage Integration ---

function appsRootHashKey(address: string) {
  return `moringa:og:apps_root:${address.toLowerCase()}`;
}

export async function syncAppsFromZeroG(signer: JsonRpcSigner): Promise<boolean> {
  const address = await signer.getAddress();
  const rootHash = localStorage.getItem(appsRootHashKey(address));
  if (!rootHash) return false;

  try {
    const remote = await downloadFromZeroGStorage(rootHash) as RawAppStore;
    if (remote && remote.v === 1) {
      return mergeRemoteAppStore(remote);
    }
  } catch (err) {
    console.error("Failed to sync apps from 0G:", err);
  }
  return false;
}

export async function uploadAppsToZeroG(signer: JsonRpcSigner): Promise<string> {
  const store = read();
  const rootHash = await uploadToZeroGStorage(signer, store);
  const address = await signer.getAddress();
  localStorage.setItem(appsRootHashKey(address), rootHash);
  return rootHash;
}

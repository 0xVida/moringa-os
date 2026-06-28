"use client";

import Link from "next/link";
import { X, Hammer, Construction, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/wallet";
import { listSavedApps, syncAppsFromZeroG, deleteApp, uploadAppsToZeroG, type SavedApp } from "@/lib/app-store";
import { AppRenderer, type AppConfig } from "@/components/app-renderer";

interface App {
  id?: string;
  name: string;
  tag: string;
  url?: string;
  isDemo?: boolean;
  config?: AppConfig;
}

function MiniAppPanel({ app, onClose }: { app: App; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-up">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-background/80 backdrop-blur-md shrink-0">
        <button
          onClick={onClose}
          className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
        >
          <X className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base truncate">{app.name}</p>
          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">
            moringa / {app.tag}
          </p>
        </div>
        {app.isDemo && (
          <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70 border border-amber-400/20 rounded-full px-2 py-0.5">
            demo
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {app.config ? (
          <div className="w-full h-full overflow-y-auto p-4 sm:p-8 bg-black">
            <div className="max-w-md mx-auto">
              <AppRenderer config={app.config} />
            </div>
          </div>
        ) : app.url ? (
          <iframe
            src={app.url}
            className="w-full h-full border-none"
            title={app.name}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center gap-6 text-center p-8 max-w-sm">
            <img src="/logo.png" alt="moringa" className="h-10 w-auto opacity-30" />
            <div>
              <p className="font-display text-3xl">{app.name}</p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {app.isDemo
                  ? "This is a demo placeholder. Build your own version in the Build tab and it will appear here."
                  : "This app is being built. Open the Build tab to update it."}
              </p>
            </div>
            <Link
              href="/build"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90 transition"
            >
              <Hammer className="size-3.5" /> Open Builder
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [open, setOpen] = useState<App | null>(null);
  const [savedApps, setSavedApps] = useState<App[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Deletion Modal State
  const [appToDelete, setAppToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { signer } = useWallet();

  const loadApps = async () => {
    const apps = await listSavedApps();
    setSavedApps(apps.map(a => ({ ...a, isDemo: false })));
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleSync = async () => {
    if (!signer) return;
    setIsSyncing(true);
    try {
      const updated = await syncAppsFromZeroG(signer);
      if (updated) await loadApps();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteApp = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setAppToDelete(id);
  };

  const confirmDelete = async () => {
    if (!appToDelete) return;
    setIsDeleting(true);
    try {
      await deleteApp(appToDelete);
      await loadApps();
      if (signer) {
        await uploadAppsToZeroG(signer);
      }
      setAppToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header — same pattern as build tab */}
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>apps</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Main surface card */}
        <div className="surface rounded-2xl p-5 sm:p-6 space-y-5">
          {/* Heading */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">your apps</p>
            <p className="font-display text-xl sm:text-2xl leading-snug">
              Apps you build live here, opening full-screen with your wallet connected.
            </p>
          </div>

          <div className="h-px bg-white/5" />

          {/* User Apps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                <span className="size-1.5 rounded-full bg-lime/60" />
                your 0g apps
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing || !signer}
                className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground hover:text-lime transition-colors disabled:opacity-50"
              >
                {isSyncing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Sync
              </button>
            </div>
            {savedApps.length > 0 ? (
              <div className="divide-y divide-white/5 mb-6 border border-white/5 rounded-xl overflow-hidden bg-white/[0.02]">
                {savedApps.map((app, i) => (
                  <div key={app.id} className="group w-full flex items-center px-4 py-3.5 hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => setOpen(app)}
                      className="flex-1 flex items-center gap-4 text-left"
                    >
                      <span className="font-mono text-[9px] text-lime w-5 shrink-0 tabular-nums">
                        0{i + 1}
                      </span>
                      <span className="flex-1 font-display text-lg leading-none group-hover:text-lime transition-colors">
                        {app.name}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-lime/70 hidden sm:block">
                        {app.tag}
                      </span>
                      <span className="font-mono text-[9px] text-lime group-hover:translate-x-1 transition-transform shrink-0">
                        run →
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteApp(e, app.id!)}
                      className="ml-4 p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 mb-6 surface-raised border border-dashed border-white/10 rounded-2xl animate-fade-up">
                <div className="size-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                  <Hammer className="size-8 text-muted-foreground/30" />
                </div>
                <h3 className="font-display text-2xl mb-2">No Mini-Apps Yet</h3>
                <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
                  You haven't saved any apps to the 0G Storage network. Head over to the Build tab, generate something awesome and click <b>Save to 0G</b>!
                </p>
                <Link
                  href="/build"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-lime transition-colors"
                >
                  <Hammer className="size-4" /> Start Building
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {open && <MiniAppPanel app={open} onClose={() => setOpen(null)} />}

      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm surface border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-up space-y-5">
            <div>
              <h3 className="font-display text-xl mb-2 text-rose-400">Delete App?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will permanently remove the app from your local library and sync the deletion to 0G Storage. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAppToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// apps tab redesigned to match build tab: list rows, amber coming-soon chip

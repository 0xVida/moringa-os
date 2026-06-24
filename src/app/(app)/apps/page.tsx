"use client";

import Link from "next/link";
import { X, Hammer, Construction } from "lucide-react";
import { useState } from "react";

interface App {
  name: string;
  tag: string;
  url?: string;
  isDemo?: boolean;
}

const demoApps: App[] = [
  { name: "Fitness Tracker Pro",  tag: "health",     isDemo: true },
  { name: "ETH Price Market",     tag: "on-chain",   isDemo: true },
  { name: "Weekly Payroll Bot",   tag: "payments",   isDemo: true },
  { name: "DAO Dashboard",        tag: "governance", isDemo: true },
];

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
        {app.url ? (
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

  return (
    <>
      <div className="space-y-5">
        {/* Header — same pattern as build tab */}
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>apps</span>
          <span className="h-px flex-1 bg-white/10" />
          <span className="flex items-center gap-1.5 text-amber-400/80">
            <Construction className="size-3" /> coming soon
          </span>
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

          {/* Demo app list */}
          <div>
            <div className="flex items-center gap-2 mb-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              <span className="size-1.5 rounded-full bg-amber-400/60" />
              demo apps
            </div>
            <div className="divide-y divide-white/5">
              {demoApps.map((app, i) => (
                <button
                  key={app.name}
                  onClick={() => setOpen(app)}
                  className="group w-full flex items-center gap-4 py-3.5 text-left"
                >
                  <span className="font-mono text-[9px] text-muted-foreground/30 w-5 shrink-0 tabular-nums">
                    0{i + 1}
                  </span>
                  <span className="flex-1 font-display text-lg leading-none group-hover:text-lime transition-colors">
                    {app.name}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hidden sm:block">
                    {app.tag}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/20 group-hover:text-lime transition-colors shrink-0">
                    open →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 text-center">
          Build an app in the Build tab and it will appear here.
        </p>
      </div>

      {open && <MiniAppPanel app={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// apps tab redesigned to match build tab: list rows, amber coming-soon chip

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Circle, Loader2, Construction, Aperture } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Interpreting request",
  "Designing app structure",
  "Selecting templates",
  "Generating UI components",
  "Connecting backend",
  "Deploying PWA",
];

function AIThinkingStream({ onDone }: { onDone?: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= STEPS.length) { onDone?.(); return; }
    const t = setTimeout(() => setI((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [i, onDone]);

  return (
    <div className="space-y-2.5">
      {STEPS.map((label, idx) => {
        const done = idx < i;
        const active = idx === i;
        return (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 transition-all",
              done || active ? "text-foreground" : "text-muted-foreground/30"
            )}
            style={done || active ? { animation: "stream 0.4s both" } : undefined}
          >
            {done ? (
              <Check className="size-3.5 text-lime shrink-0" />
            ) : active ? (
              <Loader2 className="size-3.5 text-lime animate-spin shrink-0" />
            ) : (
              <Circle className="size-3 shrink-0" />
            )}
            <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
            {active && (
              <span className="ml-auto h-px w-16 overflow-hidden bg-white/5">
                <span className="block h-full w-1/2 bg-lime" style={{ animation: "marquee 1.4s linear infinite" }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BuildPageContent() {
  const searchParams = useSearchParams();
  const p = searchParams.get("p");
  const prompt = p || "Build me a fitness tracking app with streaks";
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => { setDone(false); setKey((k) => k + 1); }, [p]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>build</span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="flex items-center gap-1.5 text-amber-400/80">
          <Construction className="size-3" /> coming soon
        </span>
      </div>

      {/* Prompt + build process in one surface */}
      <div className="surface rounded-2xl p-5 sm:p-6 space-y-5">
        {/* Prompt */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1">prompt</p>
          <p className="font-display text-xl sm:text-2xl leading-snug">"{prompt}"</p>
        </div>

        <div className="h-px bg-white/5" />

        {/* Agent steps */}
        <div>
          <div className="flex items-center gap-2 mb-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            <span className="size-1.5 rounded-full bg-lime animate-pulse-dot" />
            agent stream
          </div>
          <AIThinkingStream key={key} onDone={() => setDone(true)} />
        </div>

        {/* Done state */}
        {done && (
          <div className="animate-fade-up pt-1 border-t border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Aperture className="size-3.5 text-lime" />
                  <span className="font-mono text-xs uppercase tracking-widest text-lime">ready</span>
                </div>
                <p className="font-display text-2xl">Fitness Tracker <span className="italic text-lime">Pro</span></p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">streak-driven · pwa · v0.1.0</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-lime px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary-foreground transition hover:opacity-90">
                  Open app
                </button>
                <button className="inline-flex items-center justify-center gap-1.5 rounded-xl surface px-4 py-2 font-mono text-xs uppercase tracking-widest hover:border-lime/40 transition">
                  Install PWA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 text-center">
        Real deployment coming soon. This is a demo of the build flow.
      </p>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div className="font-mono text-xs text-muted-foreground">Loading...</div>}>
      <BuildPageContent />
    </Suspense>
  );
}

// Aperture icon: less overused than Sparkles or Zap for the ready state

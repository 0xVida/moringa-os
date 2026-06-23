import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { code: "01", label: "Interpreting request" },
  { code: "02", label: "Designing app structure" },
  { code: "03", label: "Selecting templates" },
  { code: "04", label: "Generating UI components" },
  { code: "05", label: "Connecting backend" },
  { code: "06", label: "Deploying PWA" },
];

export function AIThinkingStream({ onDone }: { onDone?: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= STEPS.length) { onDone?.(); return; }
    const t = setTimeout(() => setI((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [i, onDone]);

  return (
    <div className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-lime animate-pulse-dot" />
        agent stream
      </div>
      <div className="space-y-3">
        {STEPS.map((s, idx) => {
          const done = idx < i;
          const active = idx === i;
          return (
            <div
              key={s.code}
              className={cn(
                "flex items-center gap-3 text-sm transition-all",
                done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground/40"
              )}
              style={done || active ? { animation: "stream 0.4s both" } : undefined}
            >
              <span className="font-mono text-[10px] text-muted-foreground/60 w-6">{s.code}</span>
              {done ? <Check className="size-4 text-lime" />
                    : active ? <Loader2 className="size-4 text-lime animate-spin" />
                    : <Circle className="size-3.5" />}
              <span className="font-mono text-xs uppercase tracking-widest">{s.label}</span>
              {active && (
                <span className="ml-auto h-px w-16 sm:w-24 overflow-hidden bg-white/5">
                  <span className="block h-full w-1/2 bg-lime" style={{ animation: "marquee 1.4s linear infinite" }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

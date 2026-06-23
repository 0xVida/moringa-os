"use client";

import { Hammer, Repeat, Send, Sparkles } from "lucide-react";

const items = [
  {
    icon: Hammer,
    title: "Built Fitness Tracker Pro",
    time: "2 min ago",
    tag: "app",
    code: "001",
  },
  {
    icon: Send,
    title: "Sent 25 USDC to vendor.eth",
    time: "1 hour ago",
    tag: "tx",
    code: "002",
  },
  {
    icon: Sparkles,
    title: "Generated DAO dashboard draft",
    time: "yesterday",
    tag: "app",
    code: "003",
  },
  {
    icon: Repeat,
    title: "Scheduled 50 USDC → John every Fri",
    time: "2 days ago",
    tag: "auto",
    code: "004",
  },
];

export default function ActivityPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          activity / log
        </div>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tighter">
          Everything, <span className="italic text-lime">remembered</span>.
        </h1>
      </div>

      <div className="surface rounded-2xl divide-y divide-white/5 overflow-hidden">
        {items.map((it) => (
          <div
            key={it.code}
            className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 p-4 sm:p-5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {it.code}
            </span>
            <it.icon className="size-4 text-lime" />
            <div className="min-w-0">
              <div className="text-sm truncate text-white/95">{it.title}</div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">
                {it.time}
              </div>
            </div>
            <span className="chip">{it.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

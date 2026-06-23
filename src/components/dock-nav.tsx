"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Hammer, Wallet, LayoutGrid, Command } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",       label: "home",   icon: Home },
  { href: "/wallet", label: "wallet", icon: Wallet },
  { href: "/build",  label: "build",  icon: Hammer },
  { href: "/apps",   label: "apps",   icon: LayoutGrid },
] as const;

export function DockNav({ onOpenCommand }: { onOpenCommand: () => void }) {
  const path = usePathname();
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="surface flex items-center gap-1 rounded-full px-2 py-1.5 shadow-2xl shadow-black/40">
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "group relative flex items-center gap-2 rounded-full px-3 py-2 text-xs font-mono uppercase tracking-widest transition",
                active ? "bg-lime text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <it.icon className="size-3.5" />
              <span className="hidden sm:inline">{it.label}</span>
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
        >
          <Command className="size-3.5" />
          <span className="hidden sm:inline">⌘K</span>
        </button>
      </div>
    </nav>
  );
}

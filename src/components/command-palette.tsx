"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  Home,
  Hammer,
  Wallet,
  LayoutGrid,
  Send,
  Bot,
  Code2,
  CornerDownLeft,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useIntent } from "@/lib/use-intent";

// ── Static item definitions ────────────────────────────────────────────────────

interface NavItem {
  kind: "nav";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  keywords: string[];
}

interface ActionItem {
  kind: "action";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  prompt: string;
}

interface SubmitItem {
  kind: "submit";
}

type Item = NavItem | ActionItem | SubmitItem;

const NAV_ITEMS: NavItem[] = [
  { kind: "nav", icon: Home,       label: "Home",   href: "/",       keywords: ["home", "chat", "back", "start"] },
  { kind: "nav", icon: Wallet,     label: "Wallet", href: "/wallet", keywords: ["wallet", "balance", "og", "token", "send"] },
  { kind: "nav", icon: Hammer,     label: "Build",  href: "/build",  keywords: ["build", "create", "app", "generate", "code"] },
  { kind: "nav", icon: LayoutGrid, label: "Apps",   href: "/apps",   keywords: ["apps", "mini", "open", "launch", "telegram"] },
];

const ACTION_ITEMS: ActionItem[] = [
  { kind: "action", icon: Send,    label: "Send money",         hint: "50 OG to 0x1234…",                 prompt: "Send 50 OG to 0x1234…" },
  { kind: "action", icon: Hammer,  label: "Build an app",       hint: "Fitness tracker with streaks",      prompt: "Build me a fitness tracking app with streaks" },
  { kind: "action", icon: Bot,     label: "Ask AI anything",    hint: "Explain my wallet activity",        prompt: "Explain my wallet activity" },
  { kind: "action", icon: Code2,   label: "Generate dashboard", hint: "Sales by region, last 30 days",     prompt: "Generate a sales dashboard for sales by region, last 30 days" },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { classify } = useIntent();
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Filtered item lists ──────────────────────────────────────────────────────

  const filteredNav = useMemo<NavItem[]>(() => {
    if (!q) return NAV_ITEMS;
    const lower = q.toLowerCase();
    return NAV_ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(lower) ||
        it.keywords.some((k) => k.includes(lower))
    );
  }, [q]);

  const filteredActions = useMemo<ActionItem[]>(() => {
    if (!q) return ACTION_ITEMS;
    const lower = q.toLowerCase();
    return ACTION_ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(lower) ||
        it.hint.toLowerCase().includes(lower)
    );
  }, [q]);

  // Flat ordered list of all keyboard-selectable items
  const allItems = useMemo<Item[]>(() => {
    const items: Item[] = [...filteredNav, ...filteredActions];
    if (q.trim()) items.push({ kind: "submit" });
    return items;
  }, [filteredNav, filteredActions, q]);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQ("");
      setFocused(0);
      setIsSubmitting(false);
    }
  }, [open]);

  // Clamp focused when list shrinks
  useEffect(() => {
    if (allItems.length === 0) return;
    setFocused((f) => Math.min(f, allItems.length - 1));
  }, [allItems.length]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const submitQuery = useCallback(
    async (text?: string) => {
      const p = (text ?? q).trim();
      if (!p || isSubmitting) return;
      setIsSubmitting(true);
      try {
        const result = await classify(p);
        if (result.intent === "BUILD_APP") router.push(`/build?p=${encodeURIComponent(p)}`);
        else if (result.intent === "ON_CHAIN_TX") router.push(`/wallet?p=${encodeURIComponent(p)}`);
        else router.push(`/?p=${encodeURIComponent(p)}`);
        close();
        setQ("");
      } catch {
        router.push(`/?p=${encodeURIComponent(p)}`);
        close();
      } finally {
        setIsSubmitting(false);
      }
    },
    [q, isSubmitting, classify, router, close]
  );

  const selectItem = useCallback(
    (item: Item) => {
      if (item.kind === "nav") navigate(item.href);
      else if (item.kind === "action") submitQuery(item.prompt);
      else submitQuery();
    },
    [navigate, submitQuery]
  );

  // ── Keyboard handler ─────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((f) => (allItems.length ? (f + 1) % allItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((f) => (allItems.length ? (f - 1 + allItems.length) % allItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[focused];
      if (item) selectItem(item);
      else if (q.trim()) submitQuery();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const submitIdx = allItems.findIndex((it) => it.kind === "submit");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 surface-raised border-white/10 overflow-hidden rounded-2xl gap-0"
        onPointerDownOutside={close}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Command palette</DialogTitle>
        </VisuallyHidden.Root>
        {/* Search bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <span className="font-mono text-[11px] text-lime shrink-0">›</span>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFocused(0);
            }}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            placeholder={isSubmitting ? "routing with 0G AI…" : "navigate or ask moringa…"}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          {isSubmitting && <Sparkles className="size-3.5 text-lime animate-pulse shrink-0" />}
          <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px] text-muted-foreground/60">
            esc
          </kbd>
        </div>

        {/* Items list */}
        <div className="p-2 max-h-80 overflow-y-auto" onKeyDown={handleKeyDown}>

          {/* Navigation shortcuts */}
          {filteredNav.length > 0 && (
            <section>
              <p className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                Navigate
              </p>
              {filteredNav.map((item) => {
                const idx = allItems.indexOf(item);
                const active = focused === idx;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setFocused(idx)}
                    disabled={isSubmitting}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <item.icon
                      className={`size-4 shrink-0 transition-colors ${active ? "text-lime" : "text-muted-foreground"}`}
                    />
                    <span className="font-mono text-xs uppercase tracking-widest flex-1">
                      Go to {item.label}
                    </span>
                    <CornerDownLeft
                      className={`size-3 shrink-0 transition-opacity ${active ? "opacity-100 text-lime" : "opacity-0"}`}
                    />
                  </button>
                );
              })}
            </section>
          )}

          {/* AI prompt suggestions */}
          {filteredActions.length > 0 && (
            <section className={filteredNav.length > 0 ? "mt-1" : ""}>
              <p className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                Ask AI
              </p>
              {filteredActions.map((item) => {
                const idx = allItems.indexOf(item);
                const active = focused === idx;
                return (
                  <button
                    key={item.label}
                    onClick={() => submitQuery(item.prompt)}
                    onMouseEnter={() => setFocused(idx)}
                    disabled={isSubmitting}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <item.icon
                      className={`size-4 shrink-0 transition-colors ${active ? "text-lime" : "text-muted-foreground"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs uppercase tracking-widest">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.hint}</p>
                    </div>
                    <CornerDownLeft
                      className={`size-3 shrink-0 transition-opacity ${active ? "opacity-100 text-lime" : "opacity-0"}`}
                    />
                  </button>
                );
              })}
            </section>
          )}

          {/* Custom query submit row */}
          {q.trim() && (
            <section className="mt-1">
              <p className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                Your query
              </p>
              <button
                onClick={() => submitQuery()}
                onMouseEnter={() => setFocused(submitIdx)}
                disabled={isSubmitting}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                  focused === submitIdx
                    ? "bg-lime/10 border-lime/25"
                    : "border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <ArrowRight
                  className={`size-4 shrink-0 transition-colors ${focused === submitIdx ? "text-lime" : "text-muted-foreground"}`}
                />
                <span className="text-sm flex-1 truncate">{q}</span>
                <span
                  className={`font-mono text-[10px] shrink-0 transition-colors ${
                    focused === submitIdx ? "text-lime" : "text-muted-foreground/50"
                  }`}
                >
                  route via 0G AI →
                </span>
              </button>
            </section>
          )}

          {/* Empty state */}
          {filteredNav.length === 0 && filteredActions.length === 0 && !q.trim() && (
            <p className="py-10 text-center font-mono text-xs text-muted-foreground/40">
              Type to navigate or ask anything
            </p>
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px]">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px]">↵</kbd> select
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px]">esc</kbd> close
          </span>
          <span className="ml-auto flex items-center gap-1 text-lime/40">
            <Sparkles className="size-2.5" /> 0G AI routing
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

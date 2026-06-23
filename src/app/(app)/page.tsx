"use client";

import type { Metadata } from "next";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { ArrowRight, Hammer, Send, BarChart3, Bot, Smartphone, Link2, CornerDownLeft, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { useIntent } from "@/lib/use-intent";
import { ChatSidebar, ChatSidebarToggle } from "@/components/chat-sidebar";
import {
  listConversations,
  createConversation,
  getMessages,
  saveMessage,
  deleteConversation,
  getRawStore,
  mergeRemoteStore,
  type Conversation,
} from "@/lib/chat-store";
import {
  uploadToZeroGStorage,
  loadRemoteChatHistory,
  getStoredRootHash,
  type SyncStatus,
} from "@/lib/og-storage";
import {
  zgChat,
  ZG_RPC,
  ZG_TESTNET_CHAIN_ID,
  isSubAccountError,
  setupSubAccount,
  topUpSubAccount,
  getLedgerInfo,
  type LedgerInfo,
  type ChatMessage,
} from "@/lib/zerog";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";

const rotators = ["an app", "a market", "a payroll bot", "a wallet flow", "a dashboard", "anything"];

const examples = [
  "Build me a fitness tracking app with streaks",
  "Send 50 USDC to John every Friday",
  "Create a prediction market for ETH price",
  "Analyze my portfolio risk",
  "Generate a sales dashboard, last 30 days",
];

const quickActions = [
  { icon: Hammer,    code: "01", label: "Build App",      desc: "Describe & deploy",    href: "/build" },
  { icon: Send,      code: "02", label: "Send Money",     desc: "Anywhere, anyone",     href: "/wallet" },
  { icon: BarChart3, code: "03", label: "Create Market",  desc: "On-chain prediction",  href: "/build" },
  { icon: Bot,       code: "04", label: "Ask AI",         desc: "Anything, instantly",  href: "/build" },
  { icon: Smartphone,code: "05", label: "Deploy PWA",     desc: "Ship to home screen",  href: "/apps" },
  { icon: Link2,     code: "06", label: "Connect Wallet", desc: "On-chain in seconds",  href: "/wallet" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function HomePage() {
  const { isLoggedIn } = useAuth();
  return (
    <Suspense fallback={<div className="font-mono text-xs text-muted-foreground p-4">Loading moringa...</div>}>
      {isLoggedIn ? <LoggedInHome /> : <LoggedOutHome />}
    </Suspense>
  );
}

// ── Logged-out landing ────────────────────────────────────────────────────────

function LoggedOutHome() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [rotIdx, setRotIdx] = useState(0);
  const { classify } = useIntent();

  useEffect(() => {
    const t = setInterval(() => setRotIdx((i) => (i + 1) % rotators.length), 2200);
    return () => clearInterval(t);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (text?: string) => {
    const p = (text ?? prompt).trim();
    if (!p || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await classify(p);

      if (response.intent === "BUILD_APP") {
        router.push(`/build?p=${encodeURIComponent(p)}`);
      } else if (response.intent === "ON_CHAIN_TX") {
        router.push(`/wallet?p=${encodeURIComponent(p)}`);
      } else {
        router.push(`/chat?p=${encodeURIComponent(p)}`);
      }
    } catch (error) {
      console.error("Failed to classify intent", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-20 sm:space-y-28">
      {/* HERO — editorial */}
      <section className="pt-4 sm:pt-12">
        <div className="flex items-center gap-3 mb-8 sm:mb-12 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>001 / hello</span>
          <span className="h-px flex-1 bg-white/10" />
          <span>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>

        <h1 className="font-display leading-[0.92] tracking-tighter text-[clamp(2.75rem,10vw,8rem)] animate-fade-up">
          What shall we
          <br />
          <span className="italic text-lime relative">
            build
            <span className="inline-block w-[0.08em] h-[0.7em] align-baseline bg-lime ml-1 animate-blink" />
          </span>{" "}
          today<span className="text-muted-foreground">?</span>
        </h1>

        <div className="mt-6 sm:mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-2xl sm:text-3xl text-muted-foreground animate-fade-up" style={{ animationDelay: "120ms" }}>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">imagine</span>
          <span className="inline-block min-w-[10ch]">
            <span key={rotIdx} className="italic text-foreground inline-block animate-fade-up">{rotators[rotIdx]}</span>
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">ship it.</span>
        </div>

        {/* prompt composer */}
        <div className="mt-10 sm:mt-14 surface-raised rounded-2xl p-2 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-lime animate-pulse-dot" />
              moringa://compose
            </div>
            <span>shift+enter for newline</span>
          </div>
          <textarea
            ref={taRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="describe an app, a transaction, a workflow…"
            rows={3}
            className="w-full bg-transparent outline-none resize-none px-3 py-3 text-base sm:text-lg placeholder:text-muted-foreground/60 font-body"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              {["⌘ ai", "+ file", "+ wallet"].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
            <button
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-sm font-mono uppercase tracking-widest text-primary-foreground transition hover:scale-[1.02]"
            >
              generate <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        </div>

        {/* example chips */}
        <div className="mt-6 flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: "280ms" }}>
          <span className="chip">try</span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => handleSubmit(ex)}
              className="surface rounded-full px-3 py-1.5 text-xs hover:border-lime/40 hover:text-foreground transition text-muted-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* QUICK ACTIONS — asymmetric editorial grid */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">002 / quick</span>
            <h2 className="font-display text-3xl sm:text-4xl">do anything<span className="italic text-lime">.</span></h2>
          </div>
          <Link href="/apps" className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
            your apps <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 hairline rounded-2xl overflow-hidden">
          {quickActions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => router.push(a.href)}
              className="group relative bg-background hover:bg-white/[0.02] transition p-5 sm:p-7 text-left"
              style={{ animation: `fade-up 0.5s ${0.04 * i}s both` }}
            >
              <div className="flex items-start justify-between mb-10 sm:mb-16">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{a.code}</span>
                <a.icon className="size-4 text-muted-foreground group-hover:text-lime transition" />
              </div>
              <div className="font-display text-2xl sm:text-3xl leading-none">{a.label}</div>
              <div className="mt-2 text-xs text-muted-foreground">{a.desc}</div>
              <ArrowRight className="absolute bottom-5 right-5 size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-lime transition" />
            </button>
          ))}
        </div>
      </section>

      {/* WHAT IS MORINGA */}
      <section>
        <div className="flex items-center gap-3 mb-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>003 / what is moringa</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mb-12 sm:mb-16">
          <h2 className="font-display text-4xl sm:text-6xl tracking-tighter leading-[0.9]">
            One prompt.
            <br />
            <span className="italic text-lime">Three superpowers.</span>
          </h2>
          <p className="mt-5 text-sm text-muted-foreground max-w-md leading-relaxed">
            Moringa is an AI operating system. Type what you need and it routes to the right system automatically. Paid per action from your wallet.
          </p>
        </div>

        <div className="divide-y divide-white/5 border-t border-white/5">
          {[
            {
              num: "01",
              name: "Mini App Builder",
              lead: "Describe it. It ships.",
              body: "Fitness trackers, payroll bots, prediction markets, DAO dashboards. Built from a sentence. The app lands in your Apps tab and opens full-screen, wallet always connected.",
              spec: "No code. No IDE. Just English.",
              href: "/build",
            },
            {
              num: "02",
              name: "On-Chain Actions",
              lead: "Type it. Sign once. Done.",
              body: "Natural language turns into a transaction card. \"Send 5 OG to 0x...\" becomes a single confirm click. AI handles intent-to-transaction. You just approve.",
              spec: "Powered by 0G Compute on Newton Testnet.",
              href: "/wallet",
            },
            {
              num: "03",
              name: "AI Chat",
              lead: "Your AI. Your wallet pays.",
              body: "Chat with an AI running on 0G Compute Network, billed per-message from your on-chain balance. No subscriptions. History saves to 0G Storage and follows you across sessions.",
              spec: "Per-message billing. History on 0G Storage.",
              href: "/",
            },
          ].map((f) => (
            <Link
              key={f.name}
              href={f.href}
              className="group flex flex-col sm:flex-row gap-6 sm:gap-10 py-8 sm:py-10 transition-colors"
            >
              <div className="sm:w-56 lg:w-64 shrink-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">{f.num}</p>
                <p className="font-display text-3xl sm:text-4xl mt-1 group-hover:text-lime transition-colors leading-none">
                  {f.name}
                </p>
                <p className="mt-2 font-display text-base italic text-muted-foreground">{f.lead}</p>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">{f.spec}</p>
              </div>
              <div className="sm:self-center shrink-0">
                <ArrowRight className="size-4 text-muted-foreground/20 group-hover:text-lime group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="surface rounded-2xl p-6 sm:p-10">
        <div className="flex items-center gap-3 mb-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Zap className="size-3 text-lime" />
          004 / how it works
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { n: "01", t: "Describe it.", d: "Type anything in plain English. Build an app, send crypto, ask a question. The AI figures out your intent automatically." },
            { n: "02", t: "AI executes.", d: "Moringa routes your prompt to the right system, builds the app, parses the transaction, or generates a response. All powered by 0G Compute, paid from your wallet." },
            { n: "03", t: "It lives on.", d: "Apps you build go straight to your Apps tab. Transactions hit the chain. Chat history saves to 0G Storage. Everything persists." },
          ].map((m) => (
            <div key={m.n}>
              <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-3">{m.n}</div>
              <div className="font-display text-2xl">{m.t}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Logged-in chat home ────────────────────────────────────────────────────────

function LoggedInHome() {
  const { login, isLoggedIn } = useAuth();
  const { signer, chainId, switchToZeroGTestnet } = useWallet();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [providerAddress, setProviderAddress] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [ledgerInfo, setLedgerInfo] = useState<LedgerInfo | null>(null);
  const [probingLedger, setProbingLedger] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [setupStep, setSetupStep] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const bottomRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const p = searchParams.get("p");

  useEffect(() => {
    if (p) {
      setInput(p);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [p]);

  const isWrongNetwork = !!chainId && chainId !== ZG_TESTNET_CHAIN_ID;
  const hasExistingLedger = ledgerInfo?.exists === true;

  const refreshConversations = useCallback(async () => {
    try { setConversations(await listConversations()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // On wallet connect: try to restore chat history from 0G Storage
  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    signer.getAddress().then(async (address) => {
      if (!getStoredRootHash(address)) return;
      try {
        const remote = await loadRemoteChatHistory<ReturnType<typeof getRawStore>>(address);
        if (cancelled || !remote) return;
        const applied = mergeRemoteStore(remote);
        if (applied) refreshConversations();
      } catch { /* non-critical — local data is still available */ }
    });
    return () => { cancelled = true; };
  }, [signer, refreshConversations]);

  useEffect(() => {
    let cancelled = false;
    createZGComputeNetworkReadOnlyBroker(ZG_RPC)
      .then((ro) => ro.inference.listService())
      .then((services) => {
        if (cancelled || services.length === 0) { if (!cancelled) setProviderError("No active AI providers found on 0G network."); return; }
        if (!cancelled) setProviderAddress(services[0].provider);
      })
      .catch(() => { if (!cancelled) setProviderError("Could not reach 0G network."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setNeedsSetup(false);
    try {
      const dbMsgs = await getMessages(id);
      setMessages(dbMsgs.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } catch (e) { console.error(e); }
  }, []);

  const startNewChat = useCallback(() => { setActiveId(null); setMessages([]); setNeedsSetup(false); setInput(""); }, []);

  const handleDelete = useCallback(async (id: string) => {
    try { await deleteConversation(id); if (activeId === id) startNewChat(); await refreshConversations(); } catch (e) { console.error(e); }
  }, [activeId, refreshConversations, startNewChat]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    let convId = activeId;
    if (!convId) {
      const conv = await createConversation(text.slice(0, 60));
      convId = conv.id;
      setActiveId(convId);
      await refreshConversations();
    }
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await saveMessage(convId, "user", text);

    if (!signer || !providerAddress) {
      const offline: Message = { role: "assistant", content: "Connect your wallet to chat with the 0G AI network." };
      setMessages((prev) => [...prev, offline]);
      await saveMessage(convId, "assistant", offline.content);
      return;
    }

    const placeholder: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    const history: ChatMessage[] = [
      { role: "system", content: "You are moringa AI — a helpful assistant for building apps, managing crypto, and executing on-chain actions." },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    try {
      let fullResponse = "";
      await zgChat(signer, providerAddress, history, (token) => {
        fullResponse += token;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + token };
          return next;
        });
      });
      setMessages((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.streaming) next[next.length - 1] = { ...last, streaming: false }; return next; });
      await saveMessage(convId, "assistant", fullResponse);

      // Background sync to 0G Storage — fire and forget, no MetaMask popup
      if (signer) {
        setSyncStatus("syncing");
        uploadToZeroGStorage(signer, getRawStore())
          .then(() => setSyncStatus("synced"))
          .catch(() => setSyncStatus("error"));
      }
    } catch (err: any) {
      if (isSubAccountError(err)) {
        setMessages((prev) => prev.slice(0, -1));
        setNeedsSetup(true);
        if (signer) { setProbingLedger(true); getLedgerInfo(signer).then((info) => { setLedgerInfo(info); setProbingLedger(false); }).catch(() => setProbingLedger(false)); }
        return;
      }
      const errMsg = `Error: ${err?.message ?? "Request failed"}`;
      setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { role: "assistant", content: errMsg }; return next; });
    }
  }, [signer, providerAddress, messages, activeId, refreshConversations]);

  const handleSetup = async () => {
    if (!signer || !providerAddress) return;
    setSettingUp(true); setSetupStep("Initialising…"); setSetupError(null);
    try {
      if (hasExistingLedger) await topUpSubAccount(signer, providerAddress, setSetupStep);
      else await setupSubAccount(signer, providerAddress, setSetupStep);
      setNeedsSetup(false); setLedgerInfo(null);
    } catch (err: any) { setSetupError(err?.message ?? "Setup failed. Do you have enough OG tokens?"); }
    finally { setSettingUp(false); setSetupStep(""); }
  };

  return (
    <div className="flex h-[calc(100dvh-204px)] sm:h-[calc(100dvh-220px)] gap-4 min-h-0">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNew={startNewChat}
        onDelete={handleDelete}
        syncStatus={syncStatus}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col surface border border-white/5 rounded-2xl overflow-hidden min-w-0">
        {/* Mobile chat header with sidebar toggle */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/5 md:hidden">
          <ChatSidebarToggle onClick={() => setMobileSidebarOpen(true)} />
          {activeId && (
            <span className="font-mono text-[10px] text-muted-foreground truncate">
              {conversations.find((c) => c.id === activeId)?.title ?? "Chat"}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && !needsSetup && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <img src="/logo.png" alt="moringa" className="h-8 w-auto opacity-[0.35]" />
              <p className="text-sm opacity-60">{isLoggedIn ? "Ask moringa anything." : "Connect your wallet to start chatting."}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-4">
              <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-white/10" : "bg-lime/10 text-lime"}`}>
                {msg.role === "user" ? <span className="text-xs font-mono">You</span> : <Bot className="size-4" />}
              </div>
              <div className="flex-1 pt-1.5 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.streaming && <span className="inline-block w-[0.5em] h-[1em] align-text-bottom bg-lime ml-0.5 animate-blink" />}
              </div>
            </div>
          ))}
          {needsSetup && (
            <div className="flex flex-col gap-4 surface-raised border border-lime/20 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-lime/10 flex items-center justify-center text-lime"><Bot className="size-5" /></div>
                <div>
                  {probingLedger ? <p className="text-sm font-semibold text-white">Checking ledger…</p>
                    : hasExistingLedger ? <><p className="text-sm font-semibold text-white">Sub-Account Needs Top-Up</p><p className="text-xs text-muted-foreground mt-0.5">Transfer 1 OG to continue. Ledger has <span className="text-lime font-mono">{ledgerInfo!.freeOG.toFixed(3)} OG</span> free.</p></>
                    : <><p className="text-sm font-semibold text-white">0G Account Setup Required</p><p className="text-xs text-muted-foreground mt-0.5">No ledger found. Create one and fund the provider sub-account.</p></>}
                </div>
              </div>
              {settingUp && setupStep && <div className="flex items-center gap-2 text-xs text-lime font-mono"><span>↻</span> {setupStep}</div>}
              {setupError && <div className="text-rose-400 text-xs">{setupError}</div>}
              <button onClick={handleSetup} disabled={settingUp || isWrongNetwork || probingLedger} className="w-full py-2.5 rounded-xl bg-lime text-primary-foreground text-xs font-mono uppercase tracking-widest hover:opacity-90 transition disabled:opacity-50">
                {settingUp ? setupStep || "Working…" : hasExistingLedger ? "Top-Up (1 OG)" : "Create Ledger + Fund (4 OG)"}
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-4 bg-background/50 backdrop-blur-md border-t border-white/5">
          {!isLoggedIn ? (
            <button onClick={login} className="w-full py-3 rounded-2xl bg-lime font-mono text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90 transition">Connect Wallet to Chat</button>
          ) : (
            <div className="surface-raised rounded-2xl p-2 relative">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); } }} placeholder="Message moringa…" rows={2} className="w-full bg-transparent outline-none resize-none px-3 py-2 text-base placeholder:text-muted-foreground/60 font-body" />
              <div className="absolute bottom-3 right-3">
                <button onClick={() => sendMessage(input.trim())} className="inline-flex items-center justify-center size-8 rounded-xl bg-lime text-primary-foreground transition hover:scale-105"><ArrowRight className="size-4" /></button>
              </div>
            </div>
          )}
          <div className="text-center mt-2 text-[10px] text-muted-foreground font-mono">AI responses are paid by your 0G wallet · verify critical actions</div>
        </div>
      </div>
    </div>
  );
}

// dvh units: accounts for mobile browser chrome collapsing

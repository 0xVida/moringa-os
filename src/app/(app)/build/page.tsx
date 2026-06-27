"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Code, Sparkles, Send, Bot, User, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { ZG_RPC, zgChat, isSubAccountError, type ChatMessage } from "@/lib/zerog";
import { createZGComputeNetworkReadOnlyBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { AppRenderer, type AppConfig } from "@/components/app-renderer";
import { ChatSidebar, ChatSidebarToggle } from "@/components/chat-sidebar";
import {
  listBuildConversations,
  createBuildConversation,
  getBuildMessages,
  saveBuildMessage,
  deleteBuildConversation,
  type Conversation,
  type DbMessage
} from "@/lib/build-store";

const BUILD_SYSTEM_PROMPT = `You are an expert app architect for Moringa OS.
Your task is to build a functional mini-app based on the user's prompt by assembling pre-defined UI blocks.

You MUST respond with ONLY valid JSON. No markdown, no explanations.

## Allowed Block Types
- "header": { "type": "header", "title": string, "subtitle"?: string, "icon"?: string }
- "stat": { "type": "stat", "label": string, "value": string, "trend"?: string }
- "list": { "type": "list", "items": [{ "label": string, "sublabel"?: string, "checked"?: boolean }], "selectable"?: boolean }
- "button": { "type": "button", "label": string, "action"?: string, "variant"?: "primary" | "ghost" }
- "progress": { "type": "progress", "label": string, "value": number } // 0-100
- "text-input": { "type": "text-input", "label"?: string, "placeholder"?: string }

## JSON Schema
{
  "appName": "App Name",
  "themeColor": "#c9ff00", // Hex color
  "blocks": [ ... ] // Array of blocks
}

## Rules
- You are chatting with the user. They will ask you to create or modify an app.
- Based on the ENTIRE chat history, generate the final, updated JSON config for the app.
- Do NOT output conversational text. ONLY output the JSON config.
- The themeColor should match the app's vibe.
- Icons must be valid Lucide React icon names (e.g., "Flame", "Check", "Activity").
`;

const DEFAULT_CONFIG: AppConfig = {
  appName: "Moringa Build",
  themeColor: "#c9ff00",
  blocks: []
};

const LOADING_PHRASES = [
  "Brewing components...",
  "Wiring state...",
  "Applying theme...",
  "Assembling UI...",
  "Connecting blocks..."
];

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function BuildPageContent() {
  const searchParams = useSearchParams();
  const p = searchParams.get("p");

  const { signer } = useWallet();
  const [providerAddress, setProviderAddress] = useState<string | null>(null);

  // Sidebar & Session State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");

  // Generation State
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);

  // Preview State
  const [currentConfig, setCurrentConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Resolve 0G inference provider once
  useEffect(() => {
    let cancelled = false;
    createZGComputeNetworkReadOnlyBroker(ZG_RPC)
      .then((ro) => ro.inference.listService())
      .then((services) => { if (!cancelled && services.length > 0) setProviderAddress(services[0].provider); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const refreshConversations = useCallback(async () => {
    try { setConversations(await listBuildConversations()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Loading phrase cycler
  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => setLoadingPhraseIdx(i => (i + 1) % LOADING_PHRASES.length), 2000);
    return () => clearInterval(t);
  }, [isGenerating]);

  // Extract JSON from AI response
  const extractAndSetConfig = useCallback((raw: string) => {
    try {
      let clean = raw.trim();
      const match = clean.match(/\`\`\`(?:json)?([\s\S]*?)\`\`\`/);
      if (match) clean = match[1].trim();
      const parsed = JSON.parse(clean) as AppConfig;
      setCurrentConfig(parsed);
    } catch {
      // Keep old config if parsing fails, but we still saved the raw text
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    try {
      const dbMsgs = await getBuildMessages(id);
      const chatMsgs = dbMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      setMessages(chatMsgs);
      
      // Find the last assistant message to parse its JSON into the preview
      for (let i = chatMsgs.length - 1; i >= 0; i--) {
        if (chatMsgs[i].role === "assistant") {
          extractAndSetConfig(chatMsgs[i].content);
          break;
        }
      }
    } catch (e) { console.error(e); }
  }, [extractAndSetConfig]);

  const startNewSession = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setCurrentConfig(DEFAULT_CONFIG);
    setInput("");
    setError(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteBuildConversation(id);
      if (activeId === id) startNewSession();
      await refreshConversations();
    } catch (e) { console.error(e); }
  }, [activeId, refreshConversations, startNewSession]);

  // Initialization from search params
  useEffect(() => {
    if (p && !activeId && messages.length === 0) {
      setInput(p);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [p, activeId, messages.length]);

  const handleGenerate = async (textToSubmit?: string) => {
    const text = (textToSubmit ?? input).trim();
    if (!text || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    if (!signer || !providerAddress) {
      setError("Connect your wallet to use the AI builder.");
      setIsGenerating(false);
      return;
    }

    let convId = activeId;
    if (!convId) {
      const conv = await createBuildConversation(text.slice(0, 60));
      convId = conv.id;
      setActiveId(convId);
      await refreshConversations();
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await saveBuildMessage(convId, "user", text);

    const history: ChatMessage[] = [
      { role: "system", content: BUILD_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    try {
      let fullResponse = "";
      await zgChat(signer, providerAddress, history, (token) => {
        fullResponse += token;
      });

      const assistantMsg: ChatMsg = { role: "assistant", content: fullResponse };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveBuildMessage(convId, "assistant", fullResponse);
      
      extractAndSetConfig(fullResponse);
    } catch (err: any) {
      console.error("[build] generation error:", err);
      if (isSubAccountError(err)) {
        setError("Your 0G sub-account needs funding. Go to the chat tab to set it up.");
      } else {
        setError(err?.message || "Generation failed. Try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col space-y-5 h-[calc(100dvh-204px)] sm:h-[calc(100dvh-220px)] min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
        <button
          onClick={() => {
            // Check if mobile (approximate by window width, or just toggle both and let CSS handle it)
            if (window.innerWidth < 768) setMobileSidebarOpen(true);
            else setDesktopSidebarOpen(!desktopSidebarOpen);
          }}
          className="flex items-center gap-2 hover:text-foreground transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
          <span>History</span>
        </button>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {/* Mobile Tabs */}
      <div className="flex lg:hidden bg-white/5 rounded-lg p-1 shrink-0">
        <button 
          onClick={() => setMobileTab("chat")}
          className={cn("flex-1 py-1.5 text-xs font-mono uppercase tracking-widest rounded-md transition-colors", mobileTab === "chat" ? "bg-white/10 text-white" : "text-zinc-500")}
        >
          Chat
        </button>
        <button 
          onClick={() => setMobileTab("preview")}
          className={cn("flex-1 py-1.5 text-xs font-mono uppercase tracking-widest rounded-md transition-colors", mobileTab === "preview" ? "bg-white/10 text-white" : "text-zinc-500")}
        >
          Preview
        </button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {desktopSidebarOpen && (
          <div className="hidden md:block">
            <ChatSidebar
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onNew={startNewSession}
              onDelete={handleDelete}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        )}
        {/* We still render ChatSidebar for mobile drawer unconditionally since it manages its own mobile overlay state */}
        <div className="md:hidden">
          <ChatSidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onNew={startNewSession}
            onDelete={handleDelete}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        </div>

        <div className="flex-1 grid lg:grid-cols-5 gap-4 min-h-0">
          
          {/* LEFT: Chat Interface */}
          <div className={cn("lg:col-span-2 flex-col surface border border-white/5 rounded-2xl overflow-hidden relative bg-black/20", mobileTab === "chat" ? "flex" : "hidden lg:flex")}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-background/50 shrink-0">
              <img src="/logo.png" alt="moringa" className="size-4 object-contain opacity-80" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">App Architect</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground/50">
                  <Wand2 className="size-8" />
                  <p className="font-mono text-[10px] uppercase tracking-widest max-w-[200px]">Describe your app to start building.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("flex flex-col max-w-[90%]", m.role === "user" ? "ml-auto items-end" : "mr-auto items-start")}>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1 opacity-50">
                    {m.role === "user" ? <User className="size-3" /> : <img src="/logo.png" alt="moringa" className="size-3 object-contain opacity-80" />}
                    <span className="font-mono text-[9px] uppercase tracking-widest">
                      {m.role === "user" ? "You" : "Moringa"}
                    </span>
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    m.role === "user" ? "bg-white/10 text-white rounded-tr-sm" : "bg-zinc-900 border border-white/5 text-zinc-300 rounded-tl-sm font-mono text-[10px] overflow-hidden"
                  )}>
                    {m.role === "user" ? m.content : "App configuration updated."}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-white/5 bg-background/50 shrink-0">
              {error && (
                <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-rose-400 text-xs">
                  {error}
                </div>
              )}
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  placeholder="e.g. Make it blue and add a chart..."
                  rows={2}
                  disabled={isGenerating}
                  className="w-full bg-black border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-lime/50 transition-colors resize-none disabled:opacity-50"
                />
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || !input.trim()}
                  className="absolute right-2 bottom-2 size-8 bg-lime hover:bg-lime/90 text-black rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className={cn("lg:col-span-3 surface border border-white/5 rounded-2xl overflow-hidden relative bg-black flex-col", mobileTab === "preview" ? "flex" : "hidden lg:flex")}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-background/50 shrink-0">
              <Code className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Preview</span>
            </div>
            
            <div className="flex-1 relative overflow-y-auto p-4 sm:p-8">
              {isGenerating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-lime gap-5 animate-in fade-in duration-300">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="size-10 animate-spin opacity-20" />
                    <Sparkles className="size-4 absolute animate-pulse" />
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] animate-pulse">
                    {LOADING_PHRASES[loadingPhraseIdx]}
                  </p>
                </div>
              )}
              
              <div className={cn("transition-opacity duration-500", isGenerating && "opacity-30 blur-sm pointer-events-none")}>
                <AppRenderer config={currentConfig} />
              </div>
            </div>
          </div>

        </div>
      </div>
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

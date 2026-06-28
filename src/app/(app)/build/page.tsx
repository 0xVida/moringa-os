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
import { saveApp, uploadAppsToZeroG } from "@/lib/app-store";
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
Your task is to build a functional, interactive mini-app based on the user's prompt by assembling pre-defined UI blocks.

You MUST respond with ONLY valid JSON. No markdown, no explanations.

## Allowed Block Types
- "container": { "type": "container", "blocks": AppBlock[] } // Used for layout (e.g. grids/rows)
- "header": { "type": "header", "title": string, "subtitle"?: string, "icon"?: string }
- "stat": { "type": "stat", "label": string, "value": string, "trend"?: string }
- "list": { "type": "list", "items": [{ "label": string, "sublabel"?: string, "checked"?: boolean }], "selectable"?: boolean, "bind"?: string }
- "button": { "type": "button", "label": string, "action"?: "SET_STATE"|"ALERT"|"LINK", "actionKey"?: string, "actionValue"?: string, "variant"?: "primary" | "ghost" }
- "progress": { "type": "progress", "label": string, "value": number | string }
- "text-input": { "type": "text-input", "label"?: string, "placeholder"?: string, "bind"?: string }

## Layout & Styling
- EVERY block accepts a "className" property where you can inject Tailwind CSS classes to override default styles.
- To build complex layouts (like calculators or side-by-side elements), use a "container" block with Tailwind grids (e.g., "className": "grid grid-cols-4 gap-2").
- To change colors or sizes, use standard Tailwind utilities on the component's "className" (e.g., "bg-blue-500 text-sm").

## Design & Aesthetics (CRITICAL)
- You must generate visually stunning, modern and highly-structured UIs. Do NOT stick to generic minimal styles unless requested!
- **CONTRAST**: If using a light background color (like themeColor/primary), YOU MUST use "text-black". Do not use "text-white" on bright backgrounds.
- **DIVERSE COLORS & STYLES**: Use vibrant colors (e.g. bg-rose-500, text-amber-500, bg-indigo-500, etc.), shadows (shadow-lg), and rounded corners (rounded-2xl, rounded-full) to create premium designs.
- Use "card" blocks to wrap sections with a nice elevated dark background, or "container" blocks to group elements logically (like a 4-column grid for calculators: "className": "grid grid-cols-4 gap-2").
- Use "image" blocks to embed rich visuals! You can use 'https://picsum.photos/800/400' or similar for generic assets, or generate URL patterns if you know them. Use "className": "w-full h-48 object-cover rounded-xl" on images.
- ALWAYS include a "stat" or "header" block at the top to act as the "screen" for apps like calculators, and bind it to state.

## App Examples
**Calculator Example:**
{
  "state": { "display": "0" },
  "blocks": [
    { "type": "stat", "label": "Screen", "value": "{display}", "className": "mb-4 bg-zinc-900 text-white" },
    {
      "type": "container",
      "className": "grid grid-cols-4 gap-2",
      "blocks": [
        { "type": "button", "label": "7", "action": "SET_STATE", "actionKey": "display", "actionValue": "display === '0' ? '7' : display + '7'", "variant": "ghost" },
        { "type": "button", "label": "8", "action": "SET_STATE", "actionKey": "display", "actionValue": "display === '0' ? '8' : display + '8'", "variant": "ghost" },
        { "type": "button", "label": "9", "action": "SET_STATE", "actionKey": "display", "actionValue": "display === '0' ? '9' : display + '9'", "variant": "ghost" },
        { "type": "button", "label": "+", "action": "SET_STATE", "actionKey": "display", "actionValue": "display + ' + '", "variant": "primary" }
        // ... continue logical grid layout (4, 5, 6, -, 1, 2, 3, *, C, 0, =, /)
      ]
    }
  ]
}

## JSON Schema
{
  "appName": "App Name",
  "themeColor": "#c9ff00", // Hex color
  "state": { "count": 0, "text": "" }, // Initial state variables (optional)
  "blocks": [ ... ] // Array of blocks
}

## Interactivity Rules
- You can define a "state" object with initial values.
- Text fields (title, label, value, etc) can use string interpolation to display state: "Clicks: {count}".
- "button" blocks can have actions:
  - SET_STATE: actionKey="count", actionValue="count + 1" (Evaluates JS using state variables)
  - ALERT: actionValue="Hello {text}"
  - LINK: actionValue="https://google.com"
- "text-input" and "list" blocks can two-way bind to state by providing a "bind" property matching a state key.

## Editing Rules
- If the user asks to edit the app (e.g. "change color to red", "add a button"), YOU MUST MODIFY the CURRENT CONFIGURATION provided in the prompt. Do not recreate the app from scratch unless requested.
- Based on the ENTIRE chat history and the current config context, generate the final, updated JSON config for the app.
- Do NOT output conversational text. ONLY output the JSON config.
- Icons must be valid Lucide React icon names (e.g., "Flame", "Check", "Activity").
`;

const DEFAULT_CONFIG: AppConfig = {
  appName: "Moringa Build",
  themeColor: "#c9ff00",
  blocks: []
};

const LOADING_PHRASES = [
  "Synthesizing your ideas...",
  "Designing pixel-perfect layouts...",
  "Connecting interactive state...",
  "Applying beautiful styles...",
  "Breathing life into your app...",
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

  const [isSavingApp, setIsSavingApp] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveAppName, setSaveAppName] = useState("");
  const [saveAppTag, setSaveAppTag] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);

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
      .catch(() => { });
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

    const promptWithContext = text + `\n\n(Current Config for Context: ${JSON.stringify(currentConfig)})`;

    const history: ChatMessage[] = [
      { role: "system", content: BUILD_SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: promptWithContext },
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>
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
          <div className={cn("flex-col surface border border-white/5 rounded-2xl overflow-hidden relative bg-black/20", mobileTab === "chat" ? "flex" : "hidden lg:flex", "lg:col-span-2")}>
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
                  {m.role !== "user" && (
                    <div className="flex items-center gap-1.5 mb-1.5 px-1 opacity-50">
                      <img src="/logo.png" alt="moringa" className="size-3 object-contain opacity-80" />
                      <span className="font-mono text-[9px] uppercase tracking-widest">
                        Moringa
                      </span>
                    </div>
                  )}
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

            <div className="p-4 bg-background/50 backdrop-blur-md border-t border-white/5 shrink-0">
              {error && (
                <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-rose-400 text-xs">
                  {error}
                </div>
              )}
              <div className="surface-raised rounded-2xl p-2 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  placeholder="e.g. Make it blue and add a chart..."
                  rows={2}
                  disabled={isGenerating}
                  className="w-full bg-transparent outline-none resize-none px-3 py-2 text-base placeholder:text-muted-foreground/60 font-body disabled:opacity-50"
                />
                <div className="absolute bottom-3 right-3">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || !input.trim()}
                    className="inline-flex items-center justify-center size-8 rounded-xl bg-lime text-black transition hover:scale-105 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className={cn("surface border border-white/5 rounded-2xl overflow-hidden relative bg-black flex-col", mobileTab === "preview" ? "flex" : "hidden lg:flex", "lg:col-span-3")}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background/50 shrink-0">
              <div className="flex items-center gap-2">
                <Code className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Preview</span>
              </div>
              <button
                onClick={() => {
                  setSaveAppName(currentConfig.appName || "");
                  setShowSaveModal(true);
                }}
                disabled={currentConfig.blocks.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime/10 text-lime hover:bg-lime/20 transition-colors font-mono text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                Save to 0G
              </button>
            </div>

            <div className="flex-1 relative overflow-y-auto p-4 sm:p-8">
              {isGenerating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-lime gap-5 animate-in fade-in duration-300">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="size-10 animate-spin opacity-20" />
                    <img src="/favicon.png" alt="Moringa" className="size-5 absolute animate-pulse opacity-80" />
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

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm surface border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-up space-y-4">
            <div>
              <h3 className="font-display text-xl mb-1">Save to 0G Storage</h3>
              <p className="text-sm text-muted-foreground">Publish your mini-app permanently to the 0G decentralized network.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">App Name</label>
                <input
                  type="text"
                  value={saveAppName}
                  onChange={(e) => setSaveAppName(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Tag (e.g. utility, defi)</label>
                <input
                  type="text"
                  value={saveAppTag}
                  onChange={(e) => setSaveAppTag(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:border-lime/50"
                />
              </div>
            </div>
            {error && <div className="text-rose-400 text-xs">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!signer) {
                    setError("Please connect your wallet first.");
                    return;
                  }
                  if (!saveAppName) return;
                  setIsSavingApp(true);
                  setError(null);
                  try {
                    await saveApp(saveAppName, saveAppTag || "custom", currentConfig);
                    await uploadAppsToZeroG(signer);
                    setShowSaveModal(false);
                    setShowSuccessToast(true);
                    setTimeout(() => setShowSuccessToast(false), 3000);
                  } catch (e: any) {
                    setError(e.message || "Failed to save to 0G");
                  } finally {
                    setIsSavingApp(false);
                  }
                }}
                disabled={isSavingApp || !saveAppName}
                className="flex-1 py-2 rounded-xl bg-lime text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingApp ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSavingApp ? "Saving..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="surface-raised border border-lime/30 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
            <div className="size-6 rounded-full bg-lime/20 flex items-center justify-center">
              <Sparkles className="size-3.5 text-lime" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-lime">Success</p>
              <p className="text-sm font-display text-white">App saved to 0G Storage!</p>
            </div>
          </div>
        </div>
      )}
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

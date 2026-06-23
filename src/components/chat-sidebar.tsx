import { MessageSquare, Plus, Trash2, CloudOff, RefreshCw, CheckCircle2, X, PanelLeft } from "lucide-react";
import type { Conversation } from "@/lib/chat-store";
import type { SyncStatus } from "@/lib/og-storage";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  syncStatus?: SyncStatus;
  /** Mobile: whether the drawer is open */
  mobileOpen?: boolean;
  /** Mobile: callback to close the drawer */
  onMobileClose?: () => void;
}

function groupByDate(convs: Conversation[]) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };
  for (const c of convs) {
    const age = now - c.updated_at;
    if (age < day) groups["Today"].push(c);
    else if (age < 2 * day) groups["Yesterday"].push(c);
    else if (age < 7 * day) groups["This Week"].push(c);
    else groups["Older"].push(c);
  }
  return groups;
}

const SYNC_UI: Record<SyncStatus, { icon: React.ReactNode; label: string; color: string }> = {
  idle:    { icon: null,                                                            label: "local",       color: "text-muted-foreground/40" },
  syncing: { icon: <RefreshCw className="size-2.5 animate-spin" />,                label: "syncing…",    color: "text-yellow-400" },
  synced:  { icon: <CheckCircle2 className="size-2.5" />,                          label: "saved to 0G", color: "text-lime" },
  error:   { icon: <CloudOff className="size-2.5" />,                              label: "sync failed", color: "text-rose-400" },
};

function SidebarContent({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  syncStatus = "idle",
  onMobileClose,
}: Omit<ChatSidebarProps, "mobileOpen">) {
  const sync = SYNC_UI[syncStatus];
  const groups = groupByDate(conversations);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <MessageSquare className="size-3" />
          <span>Chats</span>
        </div>
        <div className={`flex items-center gap-1 font-mono text-[9px] ${sync.color}`}>
          {sync.icon}
          <span>{sync.label}</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={onNew}
            title="New Chat"
            className="size-6 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
          >
            <Plus className="size-3.5" />
          </button>
          {/* Close button — mobile only */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden size-6 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.entries(groups).map(([label, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={label}>
              <div className="px-2 mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                {label}
              </div>
              <div className="space-y-0.5">
                {items.map((c) => (
                  <div key={c.id} className="group relative">
                    <button
                      onClick={() => { onSelect(c.id); onMobileClose?.(); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition pr-8 ${
                        c.id === activeId
                          ? "bg-white/10 text-foreground"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      }`}
                    >
                      <div className="truncate">{c.title}</div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-5 rounded flex items-center justify-center text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-white/5 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatSidebar({
  mobileOpen = false,
  onMobileClose,
  ...props
}: ChatSidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 surface border border-white/5 rounded-2xl overflow-hidden h-full min-h-0">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile drawer — slide in from left as full-height overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-72 surface border-r border-white/5 overflow-hidden flex flex-col md:hidden" style={{ animation: "slideInLeft 0.22s ease" }}>
            <SidebarContent {...props} onMobileClose={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
}

/** Button shown in the mobile chat header to open the sidebar drawer */
export function ChatSidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
    >
      <PanelLeft className="size-4" />
      <span>History</span>
    </button>
  );
}

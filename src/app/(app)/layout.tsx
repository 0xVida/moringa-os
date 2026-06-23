"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { DockNav } from "@/components/dock-nav";
import { CommandPalette } from "@/components/command-palette";
import { useAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-screen w-full">
      <TopBar />
      <main className="px-4 pb-32 pt-6 sm:px-6 sm:pt-10 max-w-7xl mx-auto">
        {children}
      </main>
      {isLoggedIn && <DockNav onOpenCommand={() => setCmdOpen(true)} />}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

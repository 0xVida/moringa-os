"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Check,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { ZG_TESTNET_CHAIN_ID } from "@/lib/zerog";

// Deterministic pastel gradient from address
function addrGradient(addr: string) {
  const n = parseInt(addr.slice(2, 8), 16);
  const h1 = n % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},80%,45%))`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TopBar() {
  const {
    address,
    chainId,
    isConnecting,
    connect,
    disconnect,
    switchToZeroGTestnet,
    detectedWallets,
    isPicking,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnZeroG = chainId === ZG_TESTNET_CHAIN_ID;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="moringa" className="h-7 w-auto" />
          <span className="flex items-baseline gap-1">
            <span className="font-display text-2xl italic">moringa</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/os</span>
          </span>
        </Link>

        {/* Wallet area */}
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          {isConnecting && !address ? (
            /* Connecting spinner */
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 font-mono text-xs text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" /> connecting…
            </div>
          ) : address ? (
            /* Connected button */
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition group"
            >
              {/* Avatar */}
              <div
                className="size-6 rounded-full shrink-0"
                style={{ background: addrGradient(address) }}
              />
              {/* Address */}
              <span className="font-mono text-xs hidden sm:block">{shortAddr(address)}</span>
              {/* Network pill */}
              <span
                className={`hidden sm:flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                  isOnZeroG
                    ? "bg-lime/15 text-lime border border-lime/20"
                    : "bg-amber-400/15 text-amber-400 border border-amber-400/20"
                }`}
              >
                <span className={`size-1.5 rounded-full ${isOnZeroG ? "bg-lime" : "bg-amber-400"}`} />
                {isOnZeroG ? "0G" : "wrong net"}
              </span>
              <ChevronDown
                className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          ) : (
            /* Connect button */
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-lime text-primary-foreground font-mono text-xs uppercase tracking-widest hover:opacity-90 transition"
            >
              <Wallet className="size-3.5" />
              <span>Connect wallet</span>
            </button>
          )}

          {/* Dropdown */}
          {open && address && (
            <div className="absolute right-0 top-full mt-2 w-64 surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 z-50 animate-fade-up">
              {/* Identity header */}
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <div
                  className="size-10 rounded-full shrink-0"
                  style={{ background: addrGradient(address) }}
                />
                <div className="min-w-0">
                  <p className="font-mono text-xs truncate">{address}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`size-1.5 rounded-full ${isOnZeroG ? "bg-lime" : "bg-amber-400"}`}
                    />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {isOnZeroG ? "0G Newton Testnet" : "Wrong network"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition text-left"
                >
                  {copied ? (
                    <Check className="size-3.5 text-lime shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={copied ? "text-lime" : ""}>{copied ? "Copied!" : "Copy address"}</span>
                </button>

                <a
                  href={`https://testnet.0gscan.ai/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition"
                >
                  <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                  View on 0gscan
                </a>

                {!isOnZeroG && (
                  <button
                    onClick={() => { switchToZeroGTestnet(); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition text-left text-amber-400"
                  >
                    <RefreshCw className="size-3.5 shrink-0" />
                    Switch to 0G Testnet
                  </button>
                )}

                {detectedWallets.length > 1 && (
                  <button
                    onClick={() => { setOpen(false); connect(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition text-left"
                  >
                    <Wallet className="size-3.5 text-muted-foreground shrink-0" />
                    Switch wallet
                  </button>
                )}

                <div className="mx-2 my-1 h-px bg-white/5" />

                <button
                  onClick={() => { disconnect(); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition text-left text-rose-400"
                >
                  <LogOut className="size-3.5 shrink-0" />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// addrGradient: deterministic HSL gradient from first 6 chars of address

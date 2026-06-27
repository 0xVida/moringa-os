import React, { useState } from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
export type AppBlockType = "header" | "stat" | "list" | "button" | "progress" | "text-input";

export interface BaseBlock {
  type: AppBlockType;
  id?: string;
}

export interface HeaderBlock extends BaseBlock {
  type: "header";
  title: string;
  subtitle?: string;
  icon?: string;
}

export interface StatBlock extends BaseBlock {
  type: "stat";
  label: string;
  value: string;
  trend?: string;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  items: Array<{ label: string; checked?: boolean; sublabel?: string }>;
  selectable?: boolean;
}

export interface ButtonBlock extends BaseBlock {
  type: "button";
  label: string;
  action?: string;
  variant?: "primary" | "ghost";
}

export interface ProgressBlock extends BaseBlock {
  type: "progress";
  label: string;
  value: number; // 0-100
}

export interface TextInputBlock extends BaseBlock {
  type: "text-input";
  label?: string;
  placeholder?: string;
}

export type AppBlock = HeaderBlock | StatBlock | ListBlock | ButtonBlock | ProgressBlock | TextInputBlock;

export interface AppConfig {
  appName: string;
  themeColor?: string;
  blocks: AppBlock[];
}

// --- Dynamic Icon ---
function DynamicIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  // Try to find the icon component in lucide-react
  // Capitalize first letter and handle dashes if necessary
  const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-./g, x => x[1].toUpperCase());
  const IconComponent = (Icons as any)[normalizedName];
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
}

// --- Primitive Components ---
function HeaderRenderer({ block, themeColor }: { block: HeaderBlock; themeColor: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {block.icon && (
        <div 
          className="size-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
        >
          <DynamicIcon name={block.icon} className="size-6" />
        </div>
      )}
      <div>
        <h2 className="text-2xl font-display leading-tight">{block.title}</h2>
        {block.subtitle && <p className="text-sm text-zinc-400 mt-0.5">{block.subtitle}</p>}
      </div>
    </div>
  );
}

function StatRenderer({ block, themeColor }: { block: StatBlock; themeColor: string }) {
  return (
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{block.label}</span>
        {block.trend && (
          <span className="text-[10px] uppercase font-bold" style={{ color: block.trend.startsWith("-") ? "#f87171" : themeColor }}>
            {block.trend}
          </span>
        )}
      </div>
      <div className="text-4xl font-mono tracking-tight" style={{ color: themeColor }}>
        {block.value}
      </div>
    </div>
  );
}

function ListRenderer({ block, themeColor }: { block: ListBlock; themeColor: string }) {
  return (
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
      {block.items.map((item, i) => (
        <div key={i} className="p-4 flex items-center gap-3">
          {block.selectable && (
            <div 
              className={cn("size-5 rounded-md border flex items-center justify-center transition-colors")}
              style={{
                borderColor: item.checked ? themeColor : "#3f3f46",
                backgroundColor: item.checked ? themeColor : "transparent",
                color: item.checked ? "#000" : "transparent"
              }}
            >
              <Icons.Check className="size-3.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm", item.checked ? "text-zinc-400 line-through" : "text-white")}>{item.label}</p>
            {item.sublabel && <p className="text-xs text-zinc-500 truncate">{item.sublabel}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ButtonRenderer({ block, themeColor }: { block: ButtonBlock; themeColor: string }) {
  const isPrimary = block.variant !== "ghost";
  return (
    <button 
      className={cn(
        "w-full rounded-xl py-3.5 px-4 font-mono text-xs uppercase tracking-widest transition-all active:scale-[0.98]",
        isPrimary ? "text-black hover:opacity-90 font-bold" : "border border-zinc-800 text-zinc-300 hover:border-zinc-600 bg-transparent"
      )}
      style={isPrimary ? { backgroundColor: themeColor } : {}}
      onClick={() => console.log("Action triggered:", block.action)}
    >
      {block.label}
    </button>
  );
}

function ProgressRenderer({ block, themeColor }: { block: ProgressBlock; themeColor: string }) {
  const progress = Math.max(0, Math.min(100, block.value));
  return (
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">{block.label}</span>
        <span className="font-mono text-[10px] text-white">{progress}%</span>
      </div>
      <div className="h-2 w-full bg-black rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${progress}%`, backgroundColor: themeColor }} 
        />
      </div>
    </div>
  );
}

function TextInputRenderer({ block }: { block: TextInputBlock }) {
  return (
    <div className="space-y-1.5">
      {block.label && <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 pl-1">{block.label}</label>}
      <input 
        type="text" 
        placeholder={block.placeholder}
        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
      />
    </div>
  );
}

// --- Main Renderer ---

export function AppRenderer({ config }: { config: AppConfig }) {
  const themeColor = config.themeColor || "#c9ff00"; // Default Moringa Lime

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {config.blocks.map((block, i) => {
        switch (block.type) {
          case "header":
            return <HeaderRenderer key={i} block={block} themeColor={themeColor} />;
          case "stat":
            return <StatRenderer key={i} block={block} themeColor={themeColor} />;
          case "list":
            return <ListRenderer key={i} block={block} themeColor={themeColor} />;
          case "button":
            return <ButtonRenderer key={i} block={block} themeColor={themeColor} />;
          case "progress":
            return <ProgressRenderer key={i} block={block} themeColor={themeColor} />;
          case "text-input":
            return <TextInputRenderer key={i} block={block} />;
          default:
            return (
              <div key={i} className="text-xs text-red-400 font-mono p-2 border border-red-500/20 bg-red-500/10 rounded-lg">
                Unknown block type: {(block as any).type}
              </div>
            );
        }
      })}
    </div>
  );
}

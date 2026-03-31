import React, { useState, useRef, useEffect } from "react";
import { AlbumCard } from "./AlbumCard";
import { VinylDisc } from "./VinylDisc";
import type { Item } from "../types";

interface ModeSectionProps {
  title: string;
  icon: string;
  items: Item[];
  loading?: boolean;
  mode: string;
  onPick: (item: Item, mode: string) => void;
  onRefresh: () => void;
  children?: React.ReactNode;
}

// Small decorative catalog number per mode
const MODE_NUMS: Record<string, string> = {
  favorites:    "REC-01",
  discover:     "REC-02",
  for_right_now:"REC-03",
  surprise:     "REC-04",
};

export function ModeSection({
  title,
  icon,
  items,
  loading = false,
  mode,
  onPick,
  onRefresh,
  children,
}: ModeSectionProps) {
  const [cratePhase, setCratePhase] = useState<"idle" | "exit" | "enter">("idle");
  const itemsRef = useRef(items);
  const refreshingRef = useRef(false);

  // When items change after a refresh, play enter animation
  useEffect(() => {
    if (itemsRef.current !== items && refreshingRef.current) {
      itemsRef.current = items;
      refreshingRef.current = false;
      setCratePhase("enter");
      const t = setTimeout(() => setCratePhase("idle"), 400);
      return () => clearTimeout(t);
    }
    itemsRef.current = items;
  }, [items]);

  const handleRefresh = () => {
    setCratePhase("exit");
    refreshingRef.current = true;
    setTimeout(() => {
      onRefresh();
    }, 260);
  };

  const catNum = MODE_NUMS[mode] ?? "REC-00";

  return (
    <section className="py-5 border-b border-crate-border last:border-0">
      {/* Crate header */}
      <div className="px-5 mb-3 flex items-end justify-between">
        <div className="flex flex-col gap-0.5">
          {/* Catalog number */}
          <span className="text-[9px] font-mono text-crate-muted/60 tracking-[0.2em] uppercase">
            {catNum}
          </span>
          {/* Section title */}
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[28px] leading-none text-crate-text tracking-wide">
              {title.toUpperCase()}
            </h2>
            <span className="text-base leading-none opacity-60 -mb-0.5">{icon}</span>
          </div>
        </div>

        {/* New crate button */}
        <button
          onClick={handleRefresh}
          disabled={cratePhase !== "idle" || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-crate-border
                     text-[10px] font-mono font-medium text-crate-muted tracking-widest uppercase
                     hover:text-crate-text hover:border-crate-muted/40
                     disabled:opacity-40 transition-all duration-150"
          style={{ letterSpacing: "0.15em" }}
          title="New crate"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-500 ${cratePhase !== "idle" ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Flip
        </button>
      </div>

      {/* Children slot (context pills etc) */}
      {children && <div className="px-5 mb-3">{children}</div>}

      {/* Wooden crate frame */}
      <div
        className="mx-5 wood-grain overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #2e1c0a 0%, #1e1008 40%, #1e1008 60%, #2e1c0a 100%)",
          border: "2px solid #4a2e10",
          borderRadius: "2px",
          boxShadow:
            "inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.5)",
          padding: "10px 0",
        }}
      >
        {/* Crate interior overflow wrapper */}
        <div className="overflow-hidden">
          {loading ? (
            <div className="flex gap-3.5 px-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="shrink-0">
                  <div className="bg-crate-elevated animate-pulse" style={{ width: 144, height: 144 }} />
                  <div className="bg-crate-elevated animate-pulse mt-2" style={{ width: 120, height: 10 }} />
                  <div className="bg-crate-elevated animate-pulse mt-1.5" style={{ width: 90, height: 9 }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-6 px-5">
              <VinylDisc size={32} />
              <p className="text-[11px] font-mono text-crate-muted italic opacity-70">
                crate empty — add some records
              </p>
            </div>
          ) : (
            <div
              className={`flex gap-3.5 overflow-x-auto scrollbar-hide px-3
                ${cratePhase === "exit" ? "crate-exit" : cratePhase === "enter" ? "crate-enter" : ""}`}
              style={{ paddingBottom: 2 }}
            >
              {items.map((item) => (
                <AlbumCard
                  key={item.id}
                  title={item.title}
                  artist={item.creator}
                  imageUrl={item.image_url}
                  externalUri={item.external_uri}
                  externalUrl={item.external_url}
                  onPick={() => onPick(item, mode)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom crate plank */}
      <div
        className="mx-5 wood-grain"
        style={{
          height: 6,
          background: "#3d2210",
          border: "1px solid #4a2e10",
          borderTop: "none",
          boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
        }}
      />
    </section>
  );
}

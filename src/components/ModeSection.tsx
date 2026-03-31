import React from "react";
import { AlbumCard } from "./AlbumCard";
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
  return (
    <section className="px-5 pt-6 pb-5 border-b border-crate-border last:border-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[22px] font-semibold italic text-crate-text leading-none">
            {title}
          </h2>
          <span className="text-sm leading-none opacity-70">{icon}</span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-full text-crate-muted hover:text-crate-text transition-colors duration-150 hover:rotate-180 transition-transform"
          style={{ transition: "color 150ms, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          title="Re-roll suggestions"
          aria-label="Refresh suggestions"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {children}

      {loading ? (
        <div className="flex gap-3.5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="w-36 shrink-0">
              <div className="h-36 w-36 rounded-md bg-crate-elevated animate-pulse" />
              <div className="mt-2 h-3 w-28 rounded bg-crate-elevated animate-pulse" />
              <div className="mt-1.5 h-2.5 w-20 rounded bg-crate-elevated animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-crate-muted py-4 font-light italic">
          No albums yet — add some to get started
        </p>
      ) : (
        <div className="flex gap-3.5 overflow-x-auto scrollbar-hide pb-1">
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
    </section>
  );
}

import React from "react";
import { VinylDisc } from "./VinylDisc";
import { isPlaylist } from "../lib/media";
import type { Item } from "../types";

interface CoverGridProps {
  items: Item[];
  onSelect: (item: Item) => void;
  /** Faded, for items still in their cooldown. */
  dimmed?: boolean;
  /** Optional caption under the artist line, e.g. who sent a recommendation. */
  caption?: (item: Item) => string | null;
}

/** Album and playlist covers in a responsive grid; tapping one opens it. */
export function CoverGrid({ items, onSelect, dimmed, caption }: CoverGridProps) {
  return (
    // Two big covers per row in portrait; more across in landscape.
    <div className="grid grid-cols-2 landscape:grid-cols-4 lg:landscape:grid-cols-5 gap-x-3 gap-y-5" style={{ padding: "0 12px" }}>
      {items.map((item) => (
        <CoverTile key={item.id} item={item} onSelect={onSelect} dimmed={dimmed} caption={caption?.(item) ?? null} />
      ))}
    </div>
  );
}

function CoverTile({ item, onSelect, dimmed, caption }: {
  item: Item;
  onSelect: (item: Item) => void;
  dimmed?: boolean;
  caption: string | null;
}) {
  const playlist = isPlaylist(item);
  return (
    <button
      onClick={() => onSelect(item)}
      className="text-left cursor-pointer min-w-0 transition-opacity"
      style={{ background: "transparent", border: "none", padding: 0, opacity: dimmed ? 0.45 : 1 }}
      title={`${item.title} — ${item.creator}`}
    >
      <div
        className="relative w-full aspect-square overflow-hidden flex items-center justify-center"
        style={{
          background: "rgb(var(--c-elevated))",
          boxShadow: "2px 4px 12px rgba(0,0,0,0.6), inset 0 0 0 1px rgb(var(--c-hi) / calc(0.05 * var(--tint-hi)))",
        }}
      >
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <VinylDisc size={64} />
        )}
        {item.list_type === "recommendation" && (item.metadata as Record<string, unknown> | null)?._ai_suggested !== true && (
          <span
            className="absolute top-1.5 left-2 font-mono pointer-events-none"
            style={{ fontSize: 14, color: "rgb(var(--c-rec))", textShadow: "0 0 4px rgb(var(--c-rec) / calc(0.8 * var(--tint))), 0 1px 2px rgba(0,0,0,0.9)" }}
          >
            ◈
          </span>
        )}
        {(item.metadata as Record<string, unknown> | null)?._ai_suggested === true && (
          <span
            className="absolute top-1.5 right-1.5 font-mono pointer-events-none px-1.5 py-0.5"
            style={{ fontSize: 10, color: "rgb(var(--c-rec))", background: "rgba(0,0,0,0.65)", letterSpacing: "0.1em" }}
          >
            ✦ NEW
          </span>
        )}
        {playlist && (
          <span
            className="absolute bottom-1.5 left-1.5 font-mono pointer-events-none px-1.5 py-0.5"
            style={{ fontSize: 10, color: "rgb(var(--c-text))", background: "rgba(0,0,0,0.6)", letterSpacing: "0.1em" }}
          >
            ≡ PLAYLIST
          </span>
        )}
      </div>
      <div className="font-mono truncate mt-2" style={{ fontSize: 13, color: "rgb(var(--c-text))" }}>
        {item.title}
      </div>
      <div className="font-mono truncate mt-0.5" style={{ fontSize: 11, color: "rgb(var(--c-muted))", letterSpacing: "0.04em" }}>
        {item.creator}
      </div>
      {caption && (
        <div className="font-mono truncate" style={{ fontSize: 11, color: "rgb(var(--c-friend))" }}>
          {caption}
        </div>
      )}
    </button>
  );
}

/** A labelled divider between grid sections. */
export function GridHeading({ label, count, action }: { label: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ padding: "0 12px", margin: "18px 0 10px" }}>
      <span className="font-display shrink-0" style={{ fontSize: 13, color: "rgb(var(--c-text))", letterSpacing: "0.18em" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "rgb(var(--c-border))" }} />
      {count !== undefined && (
        <span className="font-mono" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{count}</span>
      )}
      {action}
    </div>
  );
}

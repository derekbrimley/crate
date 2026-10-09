import React from "react";
import { CoverGrid, GridHeading } from "./CoverGrid";
import { VinylDisc } from "./VinylDisc";
import { useSuggestions } from "../hooks/useSuggestions";
import { usePlayer } from "../hooks/usePlayer";
import type { Item } from "../types";

interface SuggestionsSectionProps {
  /** A crate id, or "discover". */
  target: string;
  onSelect: (item: Item) => void;
}

/** "Suggested by Claude": new albums for a crate or for Discover, with a refresh. */
function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Ask Claude again"
      className="flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
      style={{ width: 36, height: 36, background: "transparent", border: "1px solid rgb(var(--c-border))", color: "rgb(var(--c-rec))" }}
    >
      <svg className={loading ? "animate-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );
}

export function SuggestionsSection({ target, onSelect }: SuggestionsSectionProps) {
  const { suggestions, loading, error, refresh } = useSuggestions(target, true);
  const refreshButton = <RefreshButton loading={loading} onClick={() => void refresh()} />;

  return (
    <>
      <GridHeading label="✦ SUGGESTED BY CLAUDE" action={refreshButton} />
      {loading && suggestions.length === 0 ? (
        <div className="grid grid-cols-2 landscape:grid-cols-4 lg:landscape:grid-cols-5 gap-x-3 gap-y-5" style={{ padding: "0 12px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="animate-pulse aspect-square" style={{ background: "rgb(var(--c-elevated))" }} />
              <div className="animate-pulse mt-2" style={{ height: 13, width: "70%", background: "rgb(var(--c-elevated))" }} />
            </div>
          ))}
        </div>
      ) : error && suggestions.length === 0 ? (
        <p className="font-mono" style={{ padding: "0 12px", fontSize: 13, color: "rgb(var(--c-muted))" }}>
          Claude couldn't come up with suggestions just now. Tap ↻ to try again.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="font-mono" style={{ padding: "0 12px", fontSize: 13, color: "rgb(var(--c-muted))" }}>
          No new suggestions. Tap ↻ for another round.
        </p>
      ) : (
        <CoverGrid items={suggestions} onSelect={onSelect} />
      )}
    </>
  );
}

/**
 * Claude's suggestions as a narrow column down the right side of a crate page,
 * kept in view while the crate's own records scroll.
 */
export function SuggestionsRail({ target, onSelect }: SuggestionsSectionProps) {
  const { suggestions, loading, error, refresh } = useSuggestions(target, true);
  const { currentTrack } = usePlayer();
  // Header above; bottom nav (and the player bar, when it's showing) below.
  const below = currentTrack ? 176 : 96;

  return (
    <aside
      className="shrink-0 sticky overflow-y-auto scrollbar-hide"
      style={{
        top: 49,
        width: "clamp(112px, 30vw, 220px)",
        maxHeight: `calc(100dvh - 49px - ${below}px)`,
        padding: "14px 12px 16px 10px",
        borderLeft: "1px solid rgb(var(--c-border))",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="font-display flex-1 leading-tight" style={{ fontSize: 14, color: "rgb(var(--c-rec))", letterSpacing: "0.14em" }}>
          ✦ CLAUDE
        </span>
        <RefreshButton loading={loading} onClick={() => void refresh()} />
      </div>
      {loading && suggestions.length === 0 ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="animate-pulse aspect-square" style={{ background: "rgb(var(--c-elevated))" }} />
              <div className="animate-pulse mt-2" style={{ height: 11, width: "75%", background: "rgb(var(--c-elevated))" }} />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="font-mono" style={{ fontSize: 12, color: "rgb(var(--c-muted))", lineHeight: 1.5 }}>
          {error ? "Claude couldn't answer. Tap ↻ to retry." : "No new picks. Tap ↻ for more."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {suggestions.map((item) => (
            <button
              key={item.external_id}
              onClick={() => onSelect(item)}
              className="text-left cursor-pointer min-w-0"
              style={{ background: "transparent", border: "none", padding: 0 }}
              title={`${item.title} — ${item.creator}`}
            >
              <div className="relative w-full aspect-square overflow-hidden flex items-center justify-center" style={{ background: "rgb(var(--c-elevated))", boxShadow: "2px 4px 12px rgba(0,0,0,0.6)" }}>
                {item.image_url
                  ? <img src={item.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  : <VinylDisc size={40} />}
              </div>
              <div className="font-mono truncate mt-1.5" style={{ fontSize: 12, color: "rgb(var(--c-text))" }}>{item.title}</div>
              <div className="font-mono truncate" style={{ fontSize: 11, color: "rgb(var(--c-muted))" }}>{item.creator}</div>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

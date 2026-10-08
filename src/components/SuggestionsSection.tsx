import React from "react";
import { CoverGrid, GridHeading } from "./CoverGrid";
import { useSuggestions } from "../hooks/useSuggestions";
import type { Item } from "../types";

interface SuggestionsSectionProps {
  /** A crate id, or "discover". */
  target: string;
  onSelect: (item: Item) => void;
}

/** "Suggested by Claude": new albums for a crate or for Discover, with a refresh. */
export function SuggestionsSection({ target, onSelect }: SuggestionsSectionProps) {
  const { suggestions, loading, error, refresh } = useSuggestions(target, true);

  const refreshButton = (
    <button
      onClick={() => void refresh()}
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

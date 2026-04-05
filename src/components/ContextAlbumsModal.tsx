import React, { useEffect, useRef, useMemo } from "react";
import type { Item, RightNowContext } from "../types";

interface Props {
  context: RightNowContext;
  items: Item[];
  onClose: () => void;
}

function scoreAlbum(item: Item, prefer: string[]): number {
  const meta = item.metadata as unknown as Record<string, unknown> | null;
  const genres = (meta?.genres as string[] | undefined) ?? [];
  if (genres.length === 0) return 0.5;

  const genreStr = genres.join(" ").toLowerCase();

  let preferMatches = 0;
  for (const term of prefer) {
    if (genreStr.includes(term.toLowerCase())) preferMatches++;
  }

  if (preferMatches > 0) return 0.5 + Math.min(preferMatches * 0.15, 0.5);
  return 0.5;
}

export function ContextAlbumsModal({ context, items, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    requestAnimationFrame(() => {
      backdropRef.current?.classList.add("opacity-100");
      contentRef.current?.classList.add("translate-y-0", "opacity-100");
    });
  }, []);

  const { matching, neutral } = useMemo(() => {
    const scored = items.map((item) => ({
      item,
      score: scoreAlbum(item, context.prefer_genres),
    }));
    return {
      matching: scored.filter((s) => s.score > 0.5).sort((a, b) => b.score - a.score),
      neutral: scored.filter((s) => s.score === 0.5),
    };
  }, [items, context.prefer_genres]);

  const noGenresConfigured = context.prefer_genres.length === 0;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-[60] flex items-end sm:items-center justify-center opacity-0 transition-opacity duration-300"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={contentRef}
        className="relative w-full max-w-md max-h-full sm:max-h-[90vh] overflow-y-auto scrollbar-hide
                   translate-y-8 opacity-0 transition-all duration-300 ease-out"
        style={{
          background: "linear-gradient(180deg, #1a1210 0%, #0f0a0c 100%)",
          border: "1px solid #3d2815",
          boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 20px rgba(255,94,0,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4"
          style={{
            background: "rgba(26,18,16,0.95)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #3d2815",
            height: 44,
          }}
        >
          <span className="text-[11px] font-mono text-crate-text tracking-wider uppercase truncate mr-3">
            {context.emoji} {context.label} — Albums
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center shrink-0 text-crate-muted hover:text-crate-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 pb-8">
          {noGenresConfigured ? (
            <p className="text-[11px] font-mono text-crate-muted/70 italic">
              No genres configured. All {items.length} albums are eligible.
            </p>
          ) : (
            <>
              {matching.length > 0 && (
                <Section
                  label={`Matching — ${matching.length} album${matching.length !== 1 ? "s" : ""}`}
                  color="#ff5e00"
                  items={matching.map((s) => s.item)}
                  preferGenres={context.prefer_genres}
                />
              )}

              {neutral.length > 0 && (
                <Section
                  label={`Neutral — ${neutral.length} album${neutral.length !== 1 ? "s" : ""}`}
                  color="#907558"
                  items={neutral.map((s) => s.item)}
                  preferGenres={context.prefer_genres}
                  defaultCollapsed={matching.length > 0}
                />
              )}

              {matching.length === 0 && neutral.length === 0 && (
                <p className="text-[11px] font-mono text-crate-muted/70 italic">No albums in library.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  label: string;
  color: string;
  items: Item[];
  preferGenres: string[];
  defaultCollapsed?: boolean;
}

function Section({ label, color, items, preferGenres, defaultCollapsed = false }: SectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 mb-2 w-full text-left"
      >
        <span
          className="text-[9px] font-mono tracking-[0.2em] uppercase"
          style={{ color }}
        >
          {label}
        </span>
        <span style={{ color, fontSize: 9, opacity: 0.7 }}>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <AlbumRow
              key={item.id}
              item={item}
              preferGenres={preferGenres}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AlbumRowProps {
  item: Item;
  preferGenres: string[];
}

function AlbumRow({ item, preferGenres }: AlbumRowProps) {
  const meta = item.metadata as unknown as Record<string, unknown> | null;
  const genres = (meta?.genres as string[] | undefined) ?? [];

  const matchingGenres = genres.filter((g) =>
    preferGenres.some((p) => g.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(g.toLowerCase()))
  );

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ width: 36, height: 36, background: "#1a1210", border: "1px solid #3d2815" }}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-mono text-crate-text truncate leading-tight">{item.title}</p>
        <p className="text-[9px] font-mono text-crate-muted/60 truncate">{item.creator}</p>
        {matchingGenres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {matchingGenres.map((g) => (
              <span key={g} className="text-[8px] font-mono tracking-wider px-1 py-px" style={{ color: "#ff5e00", background: "rgba(255,94,0,0.1)", border: "1px solid rgba(255,94,0,0.25)" }}>
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

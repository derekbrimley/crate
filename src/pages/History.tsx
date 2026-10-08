import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { VinylDisc } from "../components/VinylDisc";
import { ProfileDropdown } from "../components/library/ProfileDropdown";
import { DetailPanel } from "../components/library/DetailPanel";
import { useDataCache } from "../contexts/DataCache";
import { CONTEXT_LABELS, PickHistoryEntry, Item } from "../types";

// History entries carry enough album fields to build the Item the DetailPanel needs.
// They don't carry media_type, so it comes from the stored Spotify URI.
function entryToItem(entry: PickHistoryEntry): Item {
  return {
    id: entry.item_id,
    user_id: 0,
    media_type: entry.external_uri?.startsWith("spotify:playlist:") ? "playlist" : "album",
    list_type: (entry.list_type === "favorite" ? "favorite" : "recommendation"),
    title: entry.title,
    creator: entry.creator,
    image_url: entry.image_url,
    external_id: entry.external_id,
    external_uri: entry.external_uri,
    external_url: entry.external_url,
    added_at: entry.picked_at_ts,
    metadata: null,
  };
}

// Picks record where the play started: a crate id, or one of these pages.
const MODE_SYMBOLS: Record<string, { label: string }> = {
  favorites:    { label: "Favorites" },
  discover:     { label: "Recommendations" },
  for_right_now:{ label: "Right Now" },
  surprise:     { label: "Surprise Me" },
  search:       { label: "Search" },
  library:      { label: "Library" },
  history:      { label: "History" },
  now_playing:  { label: "Now Playing" },
  play:         { label: "Played" },
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface HistoryProps {
  onLogout: () => void;
}

export function History({ onLogout }: HistoryProps) {
  const { history, historyLoaded, loadHistory, pickStats, crateDefs } = useDataCache();
  const crateNames = new Map(crateDefs.map((c) => [c.id, c.name]));
  const [loading, setLoading] = useState(!historyLoaded);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    if (!historyLoaded) {
      setLoading(true);
      loadHistory().finally(() => setLoading(false));
    }
  }, [historyLoaded, loadHistory]);

  const grouped: { label: string; entries: PickHistoryEntry[] }[] = [];
  for (const entry of history) {
    const label = formatDate(entry.picked_at_ts);
    const existing = grouped.find((g) => g.label === label);
    if (existing) existing.entries.push(entry);
    else grouped.push({ label, entries: [entry] });
  }

  const profileButton = (
    <div className="relative">
      <button
        onClick={() => setShowProfile((v) => !v)}
        className="flex items-center justify-center cursor-pointer"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgb(var(--c-knob-hi)), rgb(var(--c-knob-lo)))",
          border: showProfile ? "1.5px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
          color: showProfile ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
          boxShadow: showProfile ? "0 0 10px rgb(var(--c-accent) / calc(0.35 * var(--tint)))" : "none",
        }}
        title="Profile"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </button>
      {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
    </div>
  );

  return (
    <Layout title="Listening Log" headerRight={profileButton}>
      {loading ? (
        <div className="px-5 pt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <div className="w-12 h-12 shrink-0 animate-pulse" style={{ background: "rgb(var(--c-elevated))" }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-36 animate-pulse" style={{ background: "rgb(var(--c-elevated))" }} />
                <div className="h-2 w-24 animate-pulse" style={{ background: "rgb(var(--c-elevated))" }} />
              </div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <VinylDisc size={56} />
          <p className="font-display text-3xl text-crate-muted/25 tracking-widest">EMPTY</p>
          <p className="font-mono text-[10px] text-crate-muted/40 text-center" style={{ letterSpacing: "0.12em" }}>
            START PICKING RECORDS
            <br />TO BUILD YOUR LOG
          </p>
        </div>
      ) : (
        <div className="pb-6">
          {grouped.map(({ label, entries }) => (
            <div key={label}>
              {/* Date divider tab */}
              <div
                className="sticky z-10 flex items-center gap-3 px-5 py-2"
                style={{ top: 56, background: "rgb(var(--c-bg) / calc(0.97 * var(--tint)))", backdropFilter: "blur(12px)" }}
              >
                <div
                  className="font-display text-sm px-3 py-0.5"
                  style={{
                    color: "rgb(var(--c-muted))",
                    border: "1px solid rgb(var(--c-border) / calc(0.8 * var(--tint)))",
                    letterSpacing: "0.18em",
                    background: "rgb(var(--c-bg) / calc(0.9 * var(--tint)))",
                  }}
                >
                  {label.toUpperCase()}
                </div>
                <div className="flex-1 h-px" style={{ background: "rgb(var(--c-border) / calc(0.4 * var(--tint)))" }} />
                <span className="font-mono text-[9px]" style={{ color: "rgb(var(--c-muted) / calc(0.4 * var(--tint)))", letterSpacing: "0.1em" }}>
                  {entries.length} {entries.length === 1 ? "RECORD" : "RECORDS"}
                </span>
              </div>

              {/* Entries */}
              <ul className="px-5">
                {entries.map((entry, i) => {
                  const crateName = crateNames.get(entry.mode);
                  const modeInfo = crateName
                    ? { label: crateName.toUpperCase() }
                    : MODE_SYMBOLS[entry.mode] || { label: entry.mode.toUpperCase() };
                  const contextInfo = entry.context ? CONTEXT_LABELS[entry.context] : null;

                  return (
                    <li
                      key={entry.id}
                      onClick={() => setSelectedItem(entryToItem(entry))}
                      className="flex items-center gap-3 py-3 cursor-pointer"
                      style={{
                        borderBottom: i < entries.length - 1 ? "1px solid rgb(var(--c-border) / calc(0.3 * var(--tint)))" : "none",
                      }}
                    >
                      {/* Sleeve art */}
                      <div
                        className="shrink-0 relative"
                        style={{
                          width: 48,
                          height: 48,
                          boxShadow: "2px 2px 8px rgba(0,0,0,0.7), inset 0 0 0 1px rgb(var(--c-hi) / calc(0.06 * var(--tint-hi)))",
                        }}
                      >
                        {entry.image_url ? (
                          <img
                            src={entry.image_url}
                            alt={entry.title}
                            className="w-full h-full object-cover block"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ background: "rgb(var(--c-elevated))" }}
                          >
                            <VinylDisc size={32} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-type truncate leading-tight"
                          style={{ fontSize: 13, color: "rgb(var(--c-text))", letterSpacing: "0.01em" }}
                        >
                          {entry.title}
                        </p>
                        <p
                          className="font-mono truncate mt-0.5"
                          style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.06em" }}
                        >
                          {entry.creator}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="font-mono"
                            style={{ fontSize: 9, color: "rgb(var(--c-muted) / calc(0.5 * var(--tint)))", letterSpacing: "0.08em" }}
                          >
                            {entry.context && contextInfo
                              ? `${modeInfo.label} · ${contextInfo.label.toUpperCase()}`
                              : modeInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Time */}
                      <span
                        className="font-mono shrink-0 tabular-nums"
                        style={{ fontSize: 10, color: "rgb(var(--c-muted) / calc(0.45 * var(--tint)))", letterSpacing: "0.05em" }}
                      >
                        {formatTime(entry.picked_at_ts)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-lg overflow-y-auto"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailPanel
              item={selectedItem}
              pickCount={pickStats.get(selectedItem.id)?.pickCount ?? 0}
              lastPickedTs={pickStats.get(selectedItem.id)?.lastPickedTs ?? null}
              onClose={() => setSelectedItem(null)}
              onRemove={() => setSelectedItem(null)}
              playSource="history"
              readOnly
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

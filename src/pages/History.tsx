import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { VinylDisc } from "../components/VinylDisc";
import { useDataCache } from "../contexts/DataCache";
import { CONTEXT_LABELS, PickHistoryEntry } from "../types";

const MODE_SYMBOLS: Record<string, { label: string }> = {
  favorites:    { label: "Favorites" },
  discover:     { label: "Recommendations" },
  for_right_now:{ label: "Right Now" },
  surprise:     { label: "Surprise Me" },
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

export function History() {
  const { history, historyLoaded, loadHistory } = useDataCache();
  const [loading, setLoading] = useState(!historyLoaded);

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

  return (
    <Layout title="Listening Log">
      {loading ? (
        <div className="px-5 pt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <div className="w-12 h-12 shrink-0 animate-pulse" style={{ background: "#1a1218" }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-36 animate-pulse" style={{ background: "#1a1218" }} />
                <div className="h-2 w-24 animate-pulse" style={{ background: "#1a1218" }} />
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
                style={{ top: 56, background: "rgba(9,7,10,0.97)", backdropFilter: "blur(12px)" }}
              >
                <div
                  className="font-display text-sm px-3 py-0.5"
                  style={{
                    color: "#907558",
                    border: "1px solid rgba(61,40,21,0.8)",
                    letterSpacing: "0.18em",
                    background: "rgba(9,7,10,0.9)",
                  }}
                >
                  {label.toUpperCase()}
                </div>
                <div className="flex-1 h-px" style={{ background: "rgba(61,40,21,0.4)" }} />
                <span className="font-mono text-[9px]" style={{ color: "rgba(144,117,88,0.4)", letterSpacing: "0.1em" }}>
                  {entries.length} {entries.length === 1 ? "RECORD" : "RECORDS"}
                </span>
              </div>

              {/* Entries */}
              <ul className="px-5">
                {entries.map((entry, i) => {
                  const modeInfo = MODE_SYMBOLS[entry.mode] || { label: entry.mode.toUpperCase() };
                  const contextInfo = entry.context ? CONTEXT_LABELS[entry.context] : null;

                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 py-3"
                      style={{
                        borderBottom: i < entries.length - 1 ? "1px solid rgba(61,40,21,0.3)" : "none",
                      }}
                    >
                      {/* Sleeve art */}
                      <div
                        className="shrink-0 relative"
                        style={{
                          width: 48,
                          height: 48,
                          boxShadow: "2px 2px 8px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)",
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
                            style={{ background: "#1a1218" }}
                          >
                            <VinylDisc size={32} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-type truncate leading-tight"
                          style={{ fontSize: 13, color: "#f2e8d2", letterSpacing: "0.01em" }}
                        >
                          {entry.title}
                        </p>
                        <p
                          className="font-mono truncate mt-0.5"
                          style={{ fontSize: 10, color: "#907558", letterSpacing: "0.06em" }}
                        >
                          {entry.creator}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="font-mono"
                            style={{ fontSize: 9, color: "rgba(144,117,88,0.5)", letterSpacing: "0.08em" }}
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
                        style={{ fontSize: 10, color: "rgba(144,117,88,0.45)", letterSpacing: "0.05em" }}
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
    </Layout>
  );
}

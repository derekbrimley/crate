import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { getHistory } from "../services/api";
import type { PickHistoryEntry } from "../types";
import { CONTEXT_LABELS } from "../types";

const MODE_LABELS: Record<string, { label: string; emoji: string }> = {
  favorites: { label: "Favorites", emoji: "🎲" },
  discover: { label: "Discover", emoji: "🔮" },
  for_right_now: { label: "For Right Now", emoji: "📍" },
  surprise: { label: "Surprise Me", emoji: "✨" },
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function History() {
  const [history, setHistory] = useState<PickHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(100)
      .then(({ history }) => setHistory(history))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by date label
  const grouped: { label: string; entries: PickHistoryEntry[] }[] = [];
  for (const entry of history) {
    const label = formatDate(entry.picked_at_ts);
    const existing = grouped.find((g) => g.label === label);
    if (existing) {
      existing.entries.push(entry);
    } else {
      grouped.push({ label, entries: [entry] });
    }
  }

  return (
    <Layout title="History">
      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-crate-elevated animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 rounded bg-crate-elevated animate-pulse w-40" />
                  <div className="h-2.5 rounded bg-crate-elevated animate-pulse w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-4xl mb-4">📖</p>
            <p className="text-crate-muted text-sm">
              Your listening history will appear here once you start picking albums
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, entries }) => (
              <div key={label}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-crate-muted mb-3">
                  {label}
                </h3>
                <ul className="space-y-2">
                  {entries.map((entry) => {
                    const modeInfo = MODE_LABELS[entry.mode] || { label: entry.mode, emoji: "🎵" };
                    const contextInfo = entry.context ? CONTEXT_LABELS[entry.context] : null;

                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 p-3 bg-crate-elevated rounded-xl"
                      >
                        {entry.image_url ? (
                          <img
                            src={entry.image_url}
                            alt={entry.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
                            <span className="text-xl">🎵</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-crate-text truncate">
                            {entry.title}
                          </p>
                          <p className="text-xs text-crate-muted truncate">{entry.creator}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-crate-muted">
                              {modeInfo.emoji}{" "}
                              {entry.context && contextInfo
                                ? `${modeInfo.label}: ${contextInfo.label}`
                                : modeInfo.label}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-crate-muted shrink-0">
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
      </div>
    </Layout>
  );
}

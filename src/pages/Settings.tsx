import React, { useState, useEffect, useMemo } from "react";
import { Layout } from "../components/Layout";
import { useDataCache } from "../contexts/DataCache";
import { updateConfig } from "../services/api";
import { GenrePicker } from "../components/GenrePicker";
import { ContextAlbumsModal } from "../components/ContextAlbumsModal";
import type { RightNowContext } from "../types";

const FALLBACK_GENRES = [
  "acoustic", "alternative", "ambient", "ambient pop", "blues", "bossa nova",
  "chillhop", "classic rock", "classical", "country", "dance", "drum and bass",
  "edm", "electronic", "folk", "funk", "hard rock", "hip hop", "indie",
  "indie folk", "indie pop", "indie rock", "instrumental", "jazz", "latin",
  "lo-fi", "meditation", "metal", "neo-classical", "neo-soul", "pop",
  "post-rock", "punk", "r&b", "rap", "reggae", "rock", "shoegaze",
  "singer-songwriter", "soul",
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[9px] text-crate-muted tracking-widest uppercase mb-3"
      style={{ letterSpacing: "0.22em" }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px my-6" style={{ background: "rgba(61,40,21,0.5)" }} />;
}

export function Settings() {
  const { dashboardConfig: config, loadConfig, favorites, recommendations, listsLoaded, loadLists } = useDataCache();

  useEffect(() => {
    if (!listsLoaded) loadLists();
  }, [listsLoaded, loadLists]);

  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    [...favorites, ...recommendations].forEach((item) => {
      try {
        const meta = item.metadata as unknown as Record<string, unknown>;
        const genres = meta?.genres;
        if (Array.isArray(genres)) genres.forEach((g) => genreSet.add(g));
      } catch {
        // ignore
      }
    });
    const libraryGenres = Array.from(genreSet).sort();
    // Merge with fallback if library is sparse
    if (libraryGenres.length < 10) {
      const merged = new Set([...libraryGenres, ...FALLBACK_GENRES]);
      return Array.from(merged).sort();
    }
    return libraryGenres;
  }, [favorites, recommendations]);

  const [cardsPerMode, setCardsPerMode] = useState(config?.cards_per_mode ?? 2);
  const [savingCards, setSavingCards] = useState(false);

  const [localContexts, setLocalContexts] = useState<RightNowContext[]>(
    config?.right_now_contexts ?? []
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<RightNowContext | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savingContexts, setSavingContexts] = useState(false);

  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  useEffect(() => {
    if (config) {
      setCardsPerMode(config.cards_per_mode);
      setLocalContexts(config.right_now_contexts ?? []);
      setDirty(false);
    }
  }, [config]);

  const handleCardsChange = async (n: number) => {
    setCardsPerMode(n);
    setSavingCards(true);
    try {
      await updateConfig({ cards_per_mode: n });
      await loadConfig();
    } finally {
      setSavingCards(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
    setConfirmDelete(null);
  };

  const updateContext = (key: string, patch: Partial<RightNowContext>) => {
    setLocalContexts((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
    setDirty(true);
  };

  const deleteContext = (key: string) => {
    setLocalContexts((prev) => prev.filter((c) => c.key !== key));
    setExpandedKey(null);
    setConfirmDelete(null);
    setDirty(true);
  };

  const addContext = () => {
    const newCtx: RightNowContext = {
      key: `ctx_${Date.now()}`,
      label: "New Context",
      emoji: "🎵",
      prefer_genres: [],
      avoid_genres: [],
      prompt_hints: "",
    };
    setLocalContexts((prev) => [...prev, newCtx]);
    setExpandedKey(newCtx.key);
    setDirty(true);
  };

  const saveContexts = async () => {
    setSavingContexts(true);
    try {
      await updateConfig({
        right_now_contexts: localContexts,
        contexts: localContexts.map((c) => c.key),
      });
      await loadConfig();
      setDirty(false);
    } finally {
      setSavingContexts(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(61,40,21,0.8)",
    borderRadius: 4,
    color: "#f2e8d2",
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 12,
    padding: "6px 10px",
    width: "100%",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 9,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#907558",
    display: "block",
    marginBottom: 4,
  };

  return (
    <Layout title="Settings">
      <div className="px-5 pt-6">

        {/* ── Cards per section ── */}
        <SectionLabel>Suggestions per section</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => {
            const isActive = cardsPerMode === n;
            return (
              <button
                key={n}
                disabled={savingCards}
                onClick={() => handleCardsChange(n)}
                style={{
                  width: 40,
                  height: 40,
                  border: isActive ? "1px solid #ff5e00" : "1px solid rgba(61,40,21,0.8)",
                  background: isActive ? "rgba(255,94,0,0.12)" : "transparent",
                  color: isActive ? "#ff5e00" : "#907558",
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 14,
                  textShadow: isActive ? "0 0 8px rgba(255,94,0,0.5)" : "none",
                  boxShadow: isActive ? "0 0 8px rgba(255,94,0,0.2)" : "none",
                  borderRadius: 4,
                  cursor: savingCards ? "not-allowed" : "pointer",
                  opacity: savingCards ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="mt-2" style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>
          Albums shown per section on the main screen
        </p>

        <Divider />

        {/* ── Right Now contexts ── */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Right now contexts</SectionLabel>
          {dirty && (
            <button
              onClick={saveContexts}
              disabled={savingContexts}
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: savingContexts ? "#907558" : "#ff5e00",
                border: "1px solid",
                borderColor: savingContexts ? "rgba(61,40,21,0.8)" : "rgba(255,94,0,0.6)",
                background: "transparent",
                padding: "4px 10px",
                borderRadius: 4,
                cursor: savingContexts ? "not-allowed" : "pointer",
              }}
            >
              {savingContexts ? "Saving…" : "Save"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {localContexts.map((ctx) => {
            const isExpanded = expandedKey === ctx.key;
            return (
              <div
                key={ctx.key}
                style={{
                  border: isExpanded ? "1px solid rgba(255,94,0,0.3)" : "1px solid rgba(61,40,21,0.6)",
                  borderRadius: 6,
                  background: isExpanded ? "rgba(255,94,0,0.04)" : "transparent",
                  overflow: "hidden",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Row header */}
                <button
                  onClick={() => toggleExpand(ctx.key)}
                  className="w-full flex items-center gap-3 text-left"
                  style={{ padding: "10px 14px" }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{ctx.emoji}</span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: isExpanded ? "#ff5e00" : "#f2e8d2",
                      flex: 1,
                    }}
                  >
                    {ctx.label}
                  </span>
                  <span style={{ color: "#907558", fontSize: 10 }}>{isExpanded ? "▲" : "▼"}</span>
                </button>

                {/* Expanded edit fields */}
                {isExpanded && (
                  <div style={{ padding: "0 14px 14px" }}>
                    <div
                      className="h-px mb-4"
                      style={{ background: "rgba(61,40,21,0.5)" }}
                    />

                    <div className="flex gap-3 mb-4">
                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Label</label>
                        <input
                          style={inputStyle}
                          value={ctx.label}
                          onChange={(e) => updateContext(ctx.key, { label: e.target.value })}
                        />
                      </div>
                      {/* Emoji */}
                      <div style={{ width: 72 }}>
                        <label style={labelStyle}>Emoji</label>
                        <input
                          style={{ ...inputStyle, textAlign: "center", fontSize: 18 }}
                          value={ctx.emoji}
                          onChange={(e) => updateContext(ctx.key, { emoji: e.target.value })}
                          maxLength={4}
                        />
                      </div>
                    </div>

                    {/* Prefer genres */}
                    <div className="mb-4">
                      <label style={labelStyle}>Prefer genres</label>
                      <GenrePicker
                        available={availableGenres}
                        selected={ctx.prefer_genres}
                        onChange={(genres) => updateContext(ctx.key, { prefer_genres: genres })}
                      />
                    </div>

                    {/* Avoid genres */}
                    <div className="mb-4">
                      <label style={labelStyle}>Avoid genres</label>
                      <GenrePicker
                        available={availableGenres}
                        selected={ctx.avoid_genres}
                        onChange={(genres) => updateContext(ctx.key, { avoid_genres: genres })}
                      />
                    </div>

                    {/* Prompt hints */}
                    <div className="mb-4">
                      <label style={labelStyle}>Prompt hint (sent to Claude)</label>
                      <textarea
                        style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                        placeholder="e.g. long highway driving, upbeat energy..."
                        value={ctx.prompt_hints}
                        onChange={(e) => updateContext(ctx.key, { prompt_hints: e.target.value })}
                      />
                    </div>

                    {/* Preview albums */}
                    <div className="mb-5">
                      <button
                        onClick={() => setPreviewContext(ctx)}
                        style={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "#f2e8d2",
                          border: "1px solid rgba(242,232,210,0.2)",
                          background: "transparent",
                          padding: "5px 10px",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Preview matching albums
                      </button>
                    </div>

                    {/* Delete */}
                    {confirmDelete === ctx.key ? (
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 10,
                            color: "#907558",
                            letterSpacing: "0.1em",
                          }}
                        >
                          Remove this context?
                        </span>
                        <button
                          onClick={() => deleteContext(ctx.key)}
                          style={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "#ff4444",
                            border: "1px solid rgba(255,68,68,0.4)",
                            background: "transparent",
                            padding: "3px 8px",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "#907558",
                            border: "1px solid rgba(61,40,21,0.8)",
                            background: "transparent",
                            padding: "3px 8px",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(ctx.key)}
                        style={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "#907558",
                          border: "1px solid rgba(61,40,21,0.8)",
                          background: "transparent",
                          padding: "3px 8px",
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      >
                        Remove context
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add context */}
        <button
          onClick={addContext}
          className="w-full mt-3 flex items-center justify-center gap-2"
          style={{
            padding: "10px 14px",
            border: "1px dashed rgba(61,40,21,0.8)",
            borderRadius: 6,
            background: "transparent",
            color: "#907558",
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span>Add context</span>
        </button>

        {/* Bottom save bar (sticky) — only when dirty */}
        {dirty && (
          <div
            className="fixed bottom-16 left-0 right-0 flex justify-center z-40 px-5 pb-2 pt-3"
            style={{ background: "linear-gradient(to top, rgba(9,7,10,0.97) 70%, transparent)" }}
          >
            <button
              onClick={saveContexts}
              disabled={savingContexts}
              className="w-full max-w-xl"
              style={{
                padding: "12px",
                background: savingContexts ? "rgba(255,94,0,0.3)" : "rgba(255,94,0,0.15)",
                border: "1px solid rgba(255,94,0,0.6)",
                borderRadius: 6,
                color: savingContexts ? "#907558" : "#ff5e00",
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                cursor: savingContexts ? "not-allowed" : "pointer",
                textShadow: savingContexts ? "none" : "0 0 8px rgba(255,94,0,0.5)",
              }}
            >
              {savingContexts ? "Saving…" : "Save context changes"}
            </button>
          </div>
        )}

      </div>

      {previewContext && (
        <ContextAlbumsModal
          context={previewContext}
          items={[...favorites, ...recommendations]}
          onClose={() => setPreviewContext(null)}
        />
      )}
    </Layout>
  );
}

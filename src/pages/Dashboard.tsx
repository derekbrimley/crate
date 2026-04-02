import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { ModeSection } from "../components/ModeSection";
import { NowPlayingModal } from "../components/NowPlayingModal";
import { recordPick } from "../services/api";
import { useDataCache } from "../contexts/DataCache";
import type { Item } from "../types";
import { CONTEXT_LABELS } from "../types";

interface DashboardProps {
  onLogout: () => void;
}

const MODE_CONFIG: Record<string, { title: string; }> = {
  favorites:    { title: "Favorites" },
  discover:     { title: "Recommendations" },
  for_right_now:{ title: "Right Now" },
  surprise:     { title: "Surprise Me" },
};

export function Dashboard({ onLogout }: DashboardProps) {
  const {
    dashboardData: data,
    dashboardConfig: config,
    dashboardLoaded,
    loadDashboard,
    refreshDashboardMode,
    loadConfig,
  } = useDataCache();
  const [loading, setLoading] = useState(!dashboardLoaded);
  const [loadingModes, setLoadingModes] = useState<Set<string>>(new Set());
  const [context, setContext] = useState(() => Object.keys(CONTEXT_LABELS)[0]);

  // Derive context pills from right_now_contexts if available, else fall back to contexts + CONTEXT_LABELS
  const contextPills = config?.right_now_contexts?.length
    ? config.right_now_contexts.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji }))
    : (config?.contexts || Object.keys(CONTEXT_LABELS)).map((ctx) => ({
        key: ctx,
        label: CONTEXT_LABELS[ctx]?.label || ctx,
        emoji: CONTEXT_LABELS[ctx]?.emoji || "●",
      }));
  const [nowPlaying, setNowPlaying] = useState<Item | null>(null);

  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Wait for config so we know the correct initial context before loading the dashboard.
  // Merging the "set context from config" and "initial load" effects prevents a double-call:
  // without this, context starts as the CONTEXT_LABELS default, fires a load, then config
  // arrives and updates context, firing a second load while dashboardLoaded is still false.
  useEffect(() => {
    if (!config || dashboardLoaded) return;

    const initialCtx =
      config.right_now_contexts?.[0]?.key ??
      config.contexts?.[0] ??
      Object.keys(CONTEXT_LABELS)[0];

    setContext(initialCtx);
    setLoading(true);
    loadDashboard(initialCtx).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, dashboardLoaded]);

  const [pendingPick, setPendingPick] = useState<{ item: Item; mode: string } | null>(null);

  const handlePick = (item: Item, mode: string) => {
    setNowPlaying(item);
    setPendingPick({ item, mode });
  };

  const handlePlay = async () => {
    if (!pendingPick) return;
    const { item, mode } = pendingPick;
    setPendingPick(null);
    try {
      await recordPick({
        item_id: item.id,
        mode,
        context: mode === "for_right_now" ? context : undefined,
      });
    } catch (err) {
      console.error("Failed to record pick:", err);
    }
  };

  const refreshMode = async (mode: string) => {
    setLoadingModes((prev) => new Set([...prev, mode]));
    try {
      await refreshDashboardMode(mode, context);
    } finally {
      setLoadingModes((prev) => {
        const next = new Set(prev);
        next.delete(mode);
        return next;
      });
    }
  };

  const handleContextChange = async (newCtx: string) => {
    setContext(newCtx);
    setLoadingModes((prev) => new Set([...prev, "for_right_now"]));
    try {
      await refreshDashboardMode("for_right_now", newCtx);
    } finally {
      setLoadingModes((prev) => {
        const next = new Set(prev);
        next.delete("for_right_now");
        return next;
      });
    }
  };

  const modes = config?.dashboard_modes || ["favorites", "discover", "for_right_now", "surprise"];

  const headerRight = (
    <button
      onClick={onLogout}
      className="font-mono text-[9px] tracking-[0.2em] text-crate-muted hover:text-crate-text transition-colors uppercase"
      style={{ letterSpacing: "0.2em" }}
    >
      SIGN OUT
    </button>
  );

  return (
    <Layout headerRight={headerRight}>
      {/* Store header */}
      <div className="px-5 pt-6 pb-4 relative">


        {/* Main wordmark */}
        <h1
          className="font-display leading-none"
          style={{ fontSize: 24, color: "#39ff14", textShadow: "0 0 5px #39ff14,0 0 10px #39ff14,0 0 20px #0fa", letterSpacing: "0.4em" }}
        >
          CRATES
        </h1>

        {/* Subtitle */}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-3 h-px" style={{ background: "#907558" }} />
          <p className="font-mono text-[9px] text-crate-muted tracking-widest uppercase" style={{ letterSpacing: "0.22em" }}>
            listen up
          </p>
        </div>
      </div>

      {/* Divider with neon pink hint */}
      <div
        className="mx-5 mb-2 h-px"
        style={{ background: "linear-gradient(90deg, rgba(255,0,145,0.4) 0%, rgba(255,0,145,0.15) 30%, transparent 100%)" }}
      />

      {modes.includes("favorites") && (
        <ModeSection
          title={MODE_CONFIG.favorites.title}
          items={data.favorites || []}
          loading={loading || loadingModes.has("favorites")}
          mode="favorites"
          onPick={handlePick}
          onRefresh={() => refreshMode("favorites")}
        />
      )}

      {modes.includes("discover") && (
        <ModeSection
          title={MODE_CONFIG.discover.title}
          items={data.discover || []}
          loading={loading || loadingModes.has("discover")}
          mode="discover"
          onPick={handlePick}
          onRefresh={() => refreshMode("discover")}
        />
      )}

      {modes.includes("for_right_now") && (
        <ModeSection
          title={MODE_CONFIG.for_right_now.title}
          items={data.for_right_now || []}
          loading={loading || loadingModes.has("for_right_now")}
          mode="for_right_now"
          onPick={handlePick}
          onRefresh={() => refreshMode("for_right_now")}
        >
          {/* Context tags — styled as vintage catalog dividers */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {contextPills.map(({ key, label, emoji }) => {
              const isActive = context === key;
              return (
                <button
                  key={key}
                  onClick={() => handleContextChange(key)}
                  className="shrink-0 flex items-center gap-1.5 transition-all duration-150"
                  style={{
                    padding: "4px 10px",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: isActive ? "1px solid #ff5e00" : "1px solid rgba(61,40,21,0.8)",
                    background: isActive ? "rgba(255,94,0,0.12)" : "transparent",
                    color: isActive ? "#ff5e00" : "#907558",
                    textShadow: isActive ? "0 0 8px rgba(255,94,0,0.5)" : "none",
                    boxShadow: isActive ? "0 0 8px rgba(255,94,0,0.2),inset 0 0 4px rgba(255,94,0,0.05)" : "none",
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </ModeSection>
      )}

      {modes.includes("surprise") && (
        <ModeSection
          title={MODE_CONFIG.surprise.title}
          items={data.surprise || []}
          loading={loading || loadingModes.has("surprise")}
          mode="surprise"
          onPick={handlePick}
          onRefresh={() => refreshMode("surprise")}
        />
      )}

      {nowPlaying && (
        <NowPlayingModal
          item={nowPlaying}
          onClose={() => setNowPlaying(null)}
          onPlay={handlePlay}
        />
      )}
    </Layout>
  );
}

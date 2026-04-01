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
  const [nowPlaying, setNowPlaying] = useState<Item | null>(null);

  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  useEffect(() => {
    if (config?.contexts?.length) {
      setContext(config.contexts[0]);
    }
  }, [config]);

  useEffect(() => {
    if (!dashboardLoaded) {
      setLoading(true);
      loadDashboard(context).finally(() => setLoading(false));
    }
  }, [dashboardLoaded, loadDashboard, context]);

  const handlePick = async (item: Item, mode: string) => {
    setNowPlaying(item);
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

  const contexts = config?.contexts || Object.keys(CONTEXT_LABELS);
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
        {/* OPEN neon */}
        <div
          className="absolute top-5 right-5 font-display text-[11px] animate-neon-flicker-slow"
          style={{ color: "#39ff14", textShadow: "0 0 5px #39ff14,0 0 10px #39ff14,0 0 20px #0fa", letterSpacing: "0.4em" }}
        >
          OPEN
        </div>

        {/* Main wordmark */}
        <h1
          className="font-display leading-none"
          style={{ fontSize: 78, letterSpacing: "0.04em", color: "#f2e8d2", lineHeight: 0.9, textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
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
            {contexts.map((ctx) => {
              const info = CONTEXT_LABELS[ctx];
              const isActive = context === ctx;
              return (
                <button
                  key={ctx}
                  onClick={() => handleContextChange(ctx)}
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
                  <span>{info?.emoji || "●"}</span>
                  <span>{info?.label || ctx}</span>
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
        />
      )}
    </Layout>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";
import { ModeSection } from "../components/ModeSection";
import { getDashboard, recordPick, getConfig } from "../services/api";
import type { Item, DashboardData, AppConfig } from "../types";
import { CONTEXT_LABELS } from "../types";

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [loadingModes, setLoadingModes] = useState<Set<string>>(new Set());
  const [context, setContext] = useState(() => Object.keys(CONTEXT_LABELS)[0]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    getConfig()
      .then(({ config }) => {
        setConfig(config);
        if (config?.contexts?.length) {
          setContext(config.contexts[0]);
        }
      })
      .catch(() => {});
  }, []);

  const loadDashboard = useCallback(async (ctx?: string) => {
    setLoading(true);
    try {
      const result = await getDashboard(ctx || context);
      setData(result);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const handlePick = async (item: Item, mode: string) => {
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
      const result = await getDashboard(context);
      setData((prev) => ({ ...prev, [mode]: result[mode as keyof DashboardData] }));
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
      const result = await getDashboard(newCtx);
      setData((prev) => ({ ...prev, for_right_now: result.for_right_now }));
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
      className="text-[11px] tracking-widest uppercase text-crate-muted hover:text-crate-text transition-colors font-medium"
    >
      Sign out
    </button>
  );

  return (
    <Layout headerRight={headerRight}>
      {/* Crate Header */}
      <div className="px-5 pt-7 pb-2">
        <h1 className="font-display text-[52px] font-semibold text-crate-text tracking-tight leading-none">
          crate
        </h1>
        <p className="text-xs text-crate-muted mt-1.5 tracking-wide font-light">
          what should we listen to?
        </p>
      </div>

      {modes.includes("favorites") && (
        <ModeSection
          title="Favorites"
          icon="🎲"
          items={data.favorites || []}
          loading={loading || loadingModes.has("favorites")}
          mode="favorites"
          onPick={handlePick}
          onRefresh={() => refreshMode("favorites")}
        />
      )}

      {modes.includes("discover") && (
        <ModeSection
          title="Discover"
          icon="🔮"
          items={data.discover || []}
          loading={loading || loadingModes.has("discover")}
          mode="discover"
          onPick={handlePick}
          onRefresh={() => refreshMode("discover")}
        />
      )}

      {modes.includes("for_right_now") && (
        <ModeSection
          title="For Right Now"
          icon="📍"
          items={data.for_right_now || []}
          loading={loading || loadingModes.has("for_right_now")}
          mode="for_right_now"
          onPick={handlePick}
          onRefresh={() => refreshMode("for_right_now")}
        >
          {/* Context pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3.5">
            {contexts.map((ctx) => {
              const info = CONTEXT_LABELS[ctx];
              return (
                <button
                  key={ctx}
                  onClick={() => handleContextChange(ctx)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all duration-150 ${
                    context === ctx
                      ? "bg-crate-accent text-black"
                      : "bg-crate-elevated text-crate-muted hover:text-crate-text border border-crate-border/60"
                  }`}
                >
                  <span className="leading-none">{info?.emoji || "🎵"}</span>
                  <span>{info?.label || ctx}</span>
                </button>
              );
            })}
          </div>
        </ModeSection>
      )}

      {modes.includes("surprise") && (
        <ModeSection
          title="Surprise Me"
          icon="✨"
          items={data.surprise || []}
          loading={loading || loadingModes.has("surprise")}
          mode="surprise"
          onPick={handlePick}
          onRefresh={() => refreshMode("surprise")}
        />
      )}
    </Layout>
  );
}

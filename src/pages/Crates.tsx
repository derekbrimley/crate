import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ShelfRow } from "../components/library/ShelfRow";
import { DetailPanel } from "../components/library/DetailPanel";
import { ProfileDropdown } from "../components/library/ProfileDropdown";
import { VinylDisc } from "../components/VinylDisc";
import { recordPick, promoteAlbum } from "../services/api";
import { useDataCache } from "../contexts/DataCache";
import type { Item } from "../types";
import { CONTEXT_LABELS } from "../types";

const SPINES_PER_ROW = 4;
const CRATE_OVERLAP = 0;

interface CratesProps {
  onLogout: () => void;
}

const CRATE_META: Record<string, { name: string; desc: string }> = {
  favorites:     { name: "Favorites",    desc: "From the albums you love" },
  discover:      { name: "Discover",     desc: "From your recommendation list" },
  for_right_now: { name: "Right Now",    desc: "Matched to the moment" },
  surprise:      { name: "Surprise Me",  desc: "A random pull from the full collection" },
};

export function Crates({ onLogout }: CratesProps) {
  const {
    dashboardData: data,
    dashboardConfig: config,
    dashboardLoaded,
    loadDashboard,
    refreshDashboardMode,
    history, historyLoaded, loadHistory,
  } = useDataCache();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(!dashboardLoaded);
  const [loadingModes, setLoadingModes] = useState<Set<string>>(new Set());
  const [context, setContext] = useState(() => Object.keys(CONTEXT_LABELS)[0]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const contextPills = config?.right_now_contexts?.length
    ? config.right_now_contexts.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji }))
    : (config?.contexts || Object.keys(CONTEXT_LABELS)).map((ctx) => ({
        key: ctx,
        label: CONTEXT_LABELS[ctx]?.label || ctx,
        emoji: CONTEXT_LABELS[ctx]?.emoji || "●",
      }));

  useEffect(() => {
    if (dashboardLoaded) return;
    setLoading(true);
    loadDashboard("auto").finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!config) return;
    const initialCtx =
      config.right_now_contexts?.[0]?.key ??
      config.contexts?.[0] ??
      Object.keys(CONTEXT_LABELS)[0];
    setContext(initialCtx);
  }, [config]);

  useEffect(() => {
    if (!historyLoaded) loadHistory();
  }, [historyLoaded, loadHistory]);

  const pickStats = useMemo(() => {
    const map = new Map<number, { pickCount: number; lastPickedTs: number | null }>();
    for (const entry of history) {
      const existing = map.get(entry.item_id);
      if (existing) {
        existing.pickCount += 1;
        if (entry.picked_at_ts > (existing.lastPickedTs ?? 0)) {
          existing.lastPickedTs = entry.picked_at_ts;
        }
      } else {
        map.set(entry.item_id, { pickCount: 1, lastPickedTs: entry.picked_at_ts });
      }
    }
    return map;
  }, [history]);

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

  const handlePromote = async (item: Item) => {
    try {
      await promoteAlbum(item.id);
    } catch (err) {
      console.error("Failed to promote album:", err);
    }
  };

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

  const modes = config?.dashboard_modes || ["favorites", "discover", "for_right_now", "surprise"];

  return (
    <Layout>
      {/* Header */}
      <div
        className="sticky top-0 z-40 relative"
        style={{
          background: "rgba(15,10,12,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #3d2815",
        }}
      >
        <div className="max-w-xl lg:max-w-4xl mx-auto flex items-center" style={{ padding: "10px 12px 9px" }}>
          <h1
            className="font-display flex-1 leading-none"
            style={{
              fontSize: 22,
              color: "#39ff14",
              letterSpacing: "0.4em",
              textShadow: "0 0 6px #39ff14, 0 0 18px #0fa",
            }}
          >
            CRATES
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/add")}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#ff5e00",
                border: "none",
                color: "#fff",
                fontSize: 18,
                fontWeight: 300,
                lineHeight: 1,
                boxShadow: "0 2px 10px rgba(255,94,0,0.4)",
              }}
              title="Add albums"
            >
              +
            </button>
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3a2010, #261406)",
                border: showProfile ? "1.5px solid #ff5e00" : "1px solid #3d2815",
                color: showProfile ? "#ff5e00" : "#907558",
                boxShadow: showProfile ? "0 0 10px rgba(255,94,0,0.35)" : "none",
              }}
              title="Profile"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </button>
          </div>
        </div>
        {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      </div>

      {/* Crate shelves */}
      <div style={{ paddingTop: 18, paddingBottom: 100 }}>
        {modes.map((mode) => {
          const meta = CRATE_META[mode] || { name: mode, desc: "" };
          const items = (data[mode as keyof typeof data] as Item[] | undefined) || [];
          const isLoading = loading || loadingModes.has(mode);

          return (
            <CrateSection
              key={mode}
              mode={mode}
              name={meta.name}
              desc={meta.desc}
              items={items}
              loading={isLoading}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={setSelectedAlbumId}
              onRefresh={() => refreshMode(mode)}
              onPick={handlePick}
              pickStats={pickStats}
              contextPills={mode === "for_right_now" ? contextPills : undefined}
              activeContext={context}
              onContextChange={handleContextChange}
              onFavorite={mode === "discover" ? handlePromote : undefined}
            />
          );
        })}
      </div>
    </Layout>
  );
}

/* ─── Crate Section ─── */

interface CrateSectionProps {
  mode: string;
  name: string;
  desc: string;
  items: Item[];
  loading: boolean;
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number | null) => void;
  onRefresh: () => void;
  onPick: (item: Item, mode: string) => void;
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  contextPills?: { key: string; label: string; emoji: string }[];
  activeContext?: string;
  onContextChange?: (ctx: string) => void;
  onFavorite?: (item: Item) => void;
}

function CrateSection({
  mode,
  name,
  desc,
  items,
  loading,
  selectedAlbumId,
  onSelectAlbum,
  onRefresh,
  onPick,
  pickStats,
  contextPills,
  activeContext,
  onContextChange,
  onFavorite,
}: CrateSectionProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const selectedItem = selectedAlbumId != null
    ? items.find((a) => a.id === selectedAlbumId) || null
    : null;

  const stats = selectedItem ? pickStats.get(selectedItem.id) : undefined;

  const handleRemove = () => {
    onSelectAlbum(null);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Crate label */}
      <div className="flex items-baseline gap-2" style={{ padding: "0 12px", marginBottom: 8 }}>
        <span
          className="font-display"
          style={{ fontSize: 15, color: "#f2e8d2", letterSpacing: "0.15em" }}
        >
          {name.toUpperCase()}
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.12em" }}>
          {desc}
        </span>
        <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
        <span className="font-mono" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
          {items.length}
        </span>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center justify-center cursor-pointer disabled:opacity-40"
          style={{
            width: 20,
            height: 20,
            background: "transparent",
            border: "1px solid #3d2815",
            color: "#907558",
            fontSize: 10,
          }}
          title="Refresh crate"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-500 ${refreshing ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Context pills for Right Now */}
      {contextPills && onContextChange && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ padding: "0 12px", marginBottom: 8 }}>
          {contextPills.map(({ key, label, emoji }) => {
            const isActive = activeContext === key;
            return (
              <button
                key={key}
                onClick={() => onContextChange(key)}
                className="shrink-0 flex items-center gap-1.5 font-mono cursor-pointer"
                style={{
                  padding: "4px 10px",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
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
      )}

      {/* Shelf */}
      {loading ? (
        <div style={{ padding: "0 12px" }}>
          <div className="animate-pulse" style={{ height: 7, margin: "0 12px", background: "#2e1c0a" }} />
          <div className="animate-pulse" style={{ height: 138, margin: "0 12px", background: "#0e0609" }} />
          <div className="animate-pulse" style={{ height: 8, margin: "0 12px", background: "#221008" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-6" style={{ padding: "0 12px" }}>
          <VinylDisc size={32} />
          <p className="font-mono italic" style={{ fontSize: 11, color: "#907558", opacity: 0.7 }}>
            crate empty — add some records
          </p>
        </div>
      ) : (
        <ShelfRow
          items={items}
          spinesPerRow={SPINES_PER_ROW}
          selectedAlbumId={selectedAlbumId}
          overlap={CRATE_OVERLAP}
          autoFit
          centerItems
          onSelectAlbum={(id) => {
            onSelectAlbum(id);
          }}
          onFavorite={onFavorite}
          detailPanel={
            selectedItem ? (
              <DetailPanel
                item={selectedItem}
                pickCount={stats?.pickCount ?? 0}
                lastPickedTs={stats?.lastPickedTs ?? null}
                onClose={() => onSelectAlbum(null)}
                onRemove={handleRemove}
                onPlay={() => onPick(selectedItem, mode)}
                onPromote={onFavorite ? () => onFavorite(selectedItem) : undefined}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}

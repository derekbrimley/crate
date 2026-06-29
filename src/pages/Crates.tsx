import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ShelfRow } from "../components/library/ShelfRow";
import { DetailPanel } from "../components/library/DetailPanel";
import { ProfileDropdown } from "../components/library/ProfileDropdown";
import { VinylDisc } from "../components/VinylDisc";
import { CrateEditorModal, makeEmptyCrate } from "../components/CrateEditorModal";
import { recordPick, promoteAlbum, actOnRecommendation } from "../services/api";
import { useDataCache } from "../contexts/DataCache";
import { getItemGenres } from "../lib/filters";
import type { Item, CrateDefinition } from "../types";

const SPINES_PER_ROW = 4;
const CRATE_OVERLAP = 0;

interface CratesProps {
  onLogout: () => void;
}

function upsertCrate(list: CrateDefinition[], crate: CrateDefinition): CrateDefinition[] {
  const idx = list.findIndex((c) => c.id === crate.id);
  if (idx === -1) return [...list, crate];
  const next = [...list];
  next[idx] = crate;
  return next;
}

export function Crates({ onLogout }: CratesProps) {
  const {
    cratesData,
    crateDefs,
    dashboardLoaded,
    loadDashboard,
    refreshCrate,
    saveCrateDefs,
    pickStats,
    favorites,
    recommendations,
    listsLoaded,
    loadLists,
    history,
    historyLoaded,
    loadHistory,
  } = useDataCache();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(!dashboardLoaded);
  const [loadingCrates, setLoadingCrates] = useState<Set<string>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [editingCrate, setEditingCrate] = useState<CrateDefinition | null>(null);

  useEffect(() => {
    if (dashboardLoaded) return;
    setLoading(true);
    loadDashboard().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listsLoaded) loadLists();
  }, [listsLoaded, loadLists]);

  useEffect(() => {
    if (!historyLoaded) loadHistory();
  }, [historyLoaded, loadHistory]);


  const refreshCrateHandler = async (crateId: string) => {
    setLoadingCrates((prev) => new Set([...prev, crateId]));
    try {
      await refreshCrate(crateId);
    } finally {
      setLoadingCrates((prev) => {
        const next = new Set(prev);
        next.delete(crateId);
        return next;
      });
    }
  };

  const handlePromote = async (item: Item, crateId: string) => {
    try {
      await promoteAlbum(item.id);
      refreshCrateHandler(crateId);
    } catch (err) {
      console.error("Failed to promote album:", err);
    }
  };

  const handleAcceptFriendRec = async (item: Item, crateId: string) => {
    const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;
    const recId = meta?._rec_id;
    if (!recId) return;
    try {
      await actOnRecommendation(recId, "accept");
      refreshCrateHandler(crateId);
    } catch (err) {
      console.error("Failed to accept recommendation:", err);
    }
  };

  const handleDismissFriendRec = async (item: Item, crateId: string) => {
    const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;
    const recId = meta?._rec_id;
    if (!recId) return;
    try {
      await actOnRecommendation(recId, "dismiss");
      refreshCrateHandler(crateId);
    } catch (err) {
      console.error("Failed to dismiss recommendation:", err);
    }
  };

  const handlePick = async (item: Item, crateId: string) => {
    try {
      await recordPick({
        item_id: item.id,
        mode: crateId,
      });
    } catch (err) {
      console.error("Failed to record pick:", err);
    }
  };

  const handleSaveCrate = async (crate: CrateDefinition) => {
    const next = upsertCrate(crateDefs, crate);
    await saveCrateDefs(next);
    await refreshCrateHandler(crate.id);
    setEditingCrate(null);
  };

  const handleDeleteCrate = async (id: string) => {
    await saveCrateDefs(crateDefs.filter((c) => c.id !== id));
    setEditingCrate(null);
  };

  const availableGenres = listsLoaded
    ? Array.from(
        new Set([...favorites, ...recommendations].flatMap((item) => getItemGenres(item)))
      ).sort()
    : [];

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
              onClick={() => setEditingCrate(makeEmptyCrate(crateDefs.length))}
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
              title="New crate"
            >
              +
            </button>
            <button
              onClick={() => navigate("/add")}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3a2010, #261406)",
                border: "1px solid #3d2815",
                color: "#907558",
              }}
              title="Add albums"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
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
        {crateDefs.map((crate) => {
          const items = cratesData.get(crate.id) ?? [];
          const isLoading = loading || loadingCrates.has(crate.id);
          const isFriendCrate = crate.source === "friends";

          return (
            <CrateSection
              key={crate.id}
              crateId={crate.id}
              name={crate.name}
              desc=""
              items={items}
              loading={isLoading}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={setSelectedAlbumId}
              onRefresh={() => refreshCrateHandler(crate.id)}
              onEdit={() => setEditingCrate(crate)}
              onPick={handlePick}
              pickStats={pickStats}
              onFavorite={
                isFriendCrate
                  ? (item) => handleAcceptFriendRec(item, crate.id)
                  : (item) => handlePromote(item, crate.id)
              }
              onRemoveAlbum={
                isFriendCrate ? (item) => handleDismissFriendRec(item, crate.id) : undefined
              }
            />
          );
        })}
      </div>

      {editingCrate && (
        <CrateEditorModal
          initial={editingCrate}
          availableGenres={availableGenres}
          onSave={handleSaveCrate}
          onDelete={editingCrate.name ? handleDeleteCrate : undefined}
          onClose={() => setEditingCrate(null)}
        />
      )}
    </Layout>
  );
}

/* ─── Crate Section ─── */

interface CrateSectionProps {
  crateId: string;
  name: string;
  desc: string;
  items: Item[];
  loading: boolean;
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number | null) => void;
  onRefresh: () => void;
  onEdit: () => void;
  onPick: (item: Item, crateId: string) => void;
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  onFavorite?: (item: Item) => void;
  onRemoveAlbum?: (item: Item) => void;
}

function CrateSection({
  crateId,
  name,
  desc,
  items,
  loading,
  selectedAlbumId,
  onSelectAlbum,
  onRefresh,
  onEdit,
  onPick,
  pickStats,
  onFavorite,
  onRemoveAlbum,
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
    if (selectedItem && onRemoveAlbum) onRemoveAlbum(selectedItem);
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
          onClick={onEdit}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: 20,
            height: 20,
            background: "transparent",
            border: "1px solid #3d2815",
            color: "#907558",
            fontSize: 10,
          }}
          title="Edit crate"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
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
                onPlay={() => onPick(selectedItem, crateId)}
                onPromote={onFavorite ? () => onFavorite(selectedItem) : undefined}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}

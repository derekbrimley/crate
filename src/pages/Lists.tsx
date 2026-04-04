import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { VinylDisc } from "../components/VinylDisc";
import { NowPlayingModal } from "../components/NowPlayingModal";
import { deleteAlbum, promoteAlbum, moveAlbum } from "../services/api";
import { useDataCache } from "../contexts/DataCache";
import type { Item } from "../types";

type Tab = "favorites" | "recommendations";

function getRotation(id: number, index: number): number {
  return (((id * 13 + index * 7) % 11) - 5) * 0.9;
}

const POSTERS = [
  { artist: "THE ROLLING STONES", sub: "EXILE ON MAIN ST.",  detail: "N. AMERICA · 1972", bg: "linear-gradient(150deg,#1a0000,#3d0a00,#1a0400)", accent: "#ff3d00", rot: "-2.5deg" },
  { artist: "NIRVANA",            sub: "NEVERMIND",          detail: "WORLD TOUR · 1991", bg: "linear-gradient(150deg,#001020,#002040,#001a30)", accent: "#40c4ff", rot:  "1.5deg"  },
  { artist: "PINK FLOYD",         sub: "THE WALL",           detail: "EARLS COURT · 1980", bg: "linear-gradient(150deg,#0a0a1a,#0a1040,#050515)", accent: "#e040fb", rot: "-1deg"   },
  { artist: "TALKING HEADS",      sub: "STOP MAKING SENSE",  detail: "PANTAGES · 1983",   bg: "linear-gradient(150deg,#101000,#2d2800,#101000)", accent: "#ffe400", rot:  "3deg"    },
];

function WallRecord({
  item, rotation, index, onDelete, onPromote, onOpen, actionId, isRec,
}: {
  item: Item; rotation: number; index: number;
  onDelete: (item: Item) => void; onPromote?: (item: Item) => void;
  onOpen: (item: Item) => void;
  actionId: number | null; isRec: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const busy = actionId === item.id;

  return (
    <div
      className="relative flex flex-col items-center animate-pin-drop"
      style={{
        animationDelay: `${index * 45}ms`,
        animationFillMode: "both",
        transform: hovered ? "rotate(0deg) scale(1.07) translateY(-5px)" : `rotate(${rotation}deg)`,
        transformOrigin: "top center",
        transition: "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)",
        zIndex: hovered ? 10 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbtack */}
      <div
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-20 rounded-full"
        style={{
          width: 10, height: 10,
          background: "radial-gradient(circle at 35% 35%, #d0c0a0, #8a7050)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.8), inset 0 0 2px rgba(255,255,255,0.2)",
        }}
      />

      {/* Polaroid */}
      <div
        className="relative"
        style={{
          background: "#e4d8c4",
          padding: "4px 4px 20px",
          boxShadow: hovered
            ? "0 14px 36px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.2)"
            : "0 4px 14px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.15)",
          transition: "box-shadow 0.25s ease",
        }}
      >
        <div
          className="cursor-pointer"
          onClick={() => onOpen(item)}
          title="View album details"
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="object-cover block" style={{ width: 88, height: 88 }} loading="lazy" />
          ) : (
            <div className="flex items-center justify-center bg-crate-elevated" style={{ width: 88, height: 88 }}>
              <VinylDisc size={62} />
            </div>
          )}
        </div>
        <div className="pt-1.5 px-0.5">
          <p className="font-type truncate text-center leading-tight" style={{ fontSize: 9, color: "#3a2a1a", maxWidth: 88 }}>
            {item.title}
          </p>
        </div>
      </div>

      {/* Action buttons on hover */}
      {hovered && (
        <div className="absolute -bottom-8 flex gap-1 z-20">
          {isRec && onPromote && (
            <button
              onClick={() => onPromote(item)}
              disabled={busy}
              className="font-mono text-[8px] px-2 py-1 transition-all duration-150 disabled:opacity-50"
              style={{ background: "rgba(255,94,0,0.15)", border: "1px solid rgba(255,94,0,0.5)", color: "#ff5e00", letterSpacing: "0.1em" }}
            >
              {busy ? "…" : "★"}
            </button>
          )}
          <button
            onClick={() => onDelete(item)}
            disabled={busy}
            className="font-mono text-[8px] px-2 py-1 transition-all duration-150 disabled:opacity-50"
            style={{ background: "rgba(180,0,0,0.1)", border: "1px solid rgba(180,0,0,0.3)", color: "#ff5555", letterSpacing: "0.1em" }}
          >
            {busy ? "…" : "✕"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Lists() {
  const [tab, setTab] = useState<Tab>("favorites");
  const {
    favorites, setFavorites,
    recommendations, setRecommendations,
    listsLoaded, loadLists,
  } = useDataCache();
  const [loading, setLoading] = useState(!listsLoaded);
  const [actionId, setActionId] = useState<number | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Item | null>(null);

  useEffect(() => {
    if (!listsLoaded) {
      setLoading(true);
      loadLists().finally(() => setLoading(false));
    }
  }, [listsLoaded, loadLists]);

  const handleDelete = async (item: Item) => {
    setActionId(item.id);
    try {
      await deleteAlbum(item.id);
      if (item.list_type === "favorite") {
        setFavorites((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
      }
    } finally {
      setActionId(null);
    }
  };

  const handlePromote = async (item: Item) => {
    setActionId(item.id);
    try {
      await promoteAlbum(item.id);
      setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
      setFavorites((prev) => [{ ...item, list_type: "favorite" }, ...prev]);
    } finally {
      setActionId(null);
    }
  };

  const handleModalRemove = (item: Item) => {
    if (item.list_type === "favorite") {
      setFavorites((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
    }
    setNowPlaying(null);
  };

  const handleModalListTypeChange = (item: Item, newListType: "favorite" | "recommendation") => {
    const updated = { ...item, list_type: newListType };
    if (newListType === "favorite") {
      setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
      setFavorites((prev) => [updated, ...prev]);
    } else {
      setFavorites((prev) => prev.filter((i) => i.id !== item.id));
      setRecommendations((prev) => [updated, ...prev]);
    }
    setNowPlaying(updated);
  };

  const items = tab === "favorites" ? favorites : recommendations;

  return (
    <Layout title="The Stacks">
      {/* Poster wall strip */}
      <div
        className="relative overflow-hidden"
        style={{ height: 100, background: "#0f0a0c", borderBottom: "1px solid #3d2815" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent 0px,transparent 40px,rgba(0,0,0,0.1) 40px,rgba(0,0,0,0.1) 41px)" }}
        />
        <div className="absolute inset-0 flex items-end px-4 pb-3 gap-3 overflow-hidden">
          {POSTERS.map((p, i) => (
            <div
              key={i}
              className="shrink-0 relative overflow-hidden"
              style={{ width: 58, height: 76, background: p.bg, transform: `rotate(${p.rot})`, border: "1px solid rgba(255,255,255,0.06)", boxShadow: "2px 4px 10px rgba(0,0,0,0.7)", opacity: 0.8 }}
            >
              <div className="p-1.5 flex flex-col h-full justify-between">
                <div>
                  <p className="font-display leading-none" style={{ fontSize: 10, color: p.accent, letterSpacing: "0.03em" }}>{p.artist}</p>
                  <p className="font-display text-[7px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{p.sub}</p>
                </div>
                <p className="font-mono text-[6px]" style={{ color: "rgba(255,255,255,0.25)" }}>{p.detail}</p>
              </div>
            </div>
          ))}

          {/* Neon sign */}
          <div
            className="absolute right-4 top-3 font-display text-[17px] animate-neon-flicker-slow"
            style={{ color: "#ff0091", textShadow: "0 0 6px #ff0091,0 0 12px #ff0091,0 0 22px #f09", letterSpacing: "0.3em" }}
          >
            RECORDS
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="sticky z-30 flex px-5 gap-0 border-b border-crate-border"
        style={{ top: 56, background: "rgba(9,7,10,0.97)", backdropFilter: "blur(12px)" }}
      >
        {(["favorites", "recommendations"] as Tab[]).map((t) => {
          const isActive = tab === t;
          const count = t === "favorites" ? favorites.length : recommendations.length;
          const label = t === "favorites" ? "FAVORITES" : "RECS";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-3 mr-6 font-display text-sm transition-all duration-150 flex items-center gap-2"
              style={{
                borderBottom: isActive ? "2px solid #ff5e00" : "2px solid transparent",
                color: isActive ? "#ff5e00" : "#907558",
                letterSpacing: "0.18em",
                textShadow: isActive ? "0 0 8px rgba(255,94,0,0.4)" : "none",
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="font-mono text-[9px] px-1.5 py-0.5"
                  style={{
                    background: isActive ? "rgba(255,94,0,0.12)" : "rgba(61,40,21,0.5)",
                    color: isActive ? "#ff5e00" : "#907558",
                    border: `1px solid ${isActive ? "rgba(255,94,0,0.4)" : "rgba(61,40,21,0.8)"}`,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Wall of records */}
      <div
        className="relative min-h-[300px] px-5 pt-8 pb-6"
        style={{ background: "linear-gradient(180deg,#0d0a0e 0%,#09070a 100%)" }}
      >
        {/* Wall paneling texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent 0px,transparent 55px,rgba(0,0,0,0.12) 55px,rgba(0,0,0,0.12) 56px)" }}
        />

        {loading ? (
          <div className="grid grid-cols-3 gap-8 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="animate-pulse" style={{ width: 96, height: 116, background: "#e4d8c4", opacity: 0.15 }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <VinylDisc size={56} />
            <p className="font-display text-3xl text-crate-muted/25 tracking-widest">EMPTY</p>
            <p className="font-mono text-[10px] text-crate-muted/40 text-center" style={{ letterSpacing: "0.1em" }}>
              {tab === "favorites" ? "No favorites — dig for records first" : "No recs — add some to discover"}
            </p>
          </div>
        ) : (
          <div className="relative grid grid-cols-3 gap-x-4 gap-y-10">
            {items.map((item, i) => (
              <WallRecord
                key={item.id}
                item={item}
                rotation={getRotation(item.id, i)}
                index={i}
                onDelete={handleDelete}
                onPromote={handlePromote}
                onOpen={setNowPlaying}
                actionId={actionId}
                isRec={tab === "recommendations"}
              />
            ))}
          </div>
        )}
      </div>
      {nowPlaying && (
        <NowPlayingModal
          item={nowPlaying}
          onClose={() => setNowPlaying(null)}
          onRemove={handleModalRemove}
          onListTypeChange={handleModalListTypeChange}
        />
      )}
    </Layout>
  );
}

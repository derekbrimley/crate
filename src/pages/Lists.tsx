import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { LibraryShelf } from "../components/library/LibraryShelf";
import { ProfileDropdown } from "../components/library/ProfileDropdown";
import { VinylDisc } from "../components/VinylDisc";
import { useDataCache } from "../contexts/DataCache";
import type { Item } from "../types";

const SPINES_PER_ROW = 14;

type SortKey = "title" | "artist" | "plays" | "recent" | "added";
type GroupKey = "none" | "artist" | "genre";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "title", label: "TITLE" },
  { key: "artist", label: "ARTIST" },
  { key: "plays", label: "PLAYS" },
  { key: "recent", label: "RECENT" },
  { key: "added", label: "ADDED" },
];

const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: "none", label: "NONE" },
  { key: "artist", label: "ARTIST" },
  { key: "genre", label: "GENRE" },
];

interface ListsProps {
  onLogout: () => void;
}

export function Lists({ onLogout }: ListsProps) {
  const {
    favorites, setFavorites,
    listsLoaded, loadLists,
    history, historyLoaded, loadHistory,
  } = useDataCache();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(!listsLoaded);
  const [sort, setSort] = useState<SortKey>("artist");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [group, setGroup] = useState<GroupKey>("none");
  const [search, setSearch] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!listsLoaded) {
      setLoading(true);
      loadLists().finally(() => setLoading(false));
    }
  }, [listsLoaded, loadLists]);

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

  const filtered = useMemo(() => {
    if (!search) return favorites;
    const q = search.toLowerCase();
    return favorites.filter(
      (a) => a.title.toLowerCase().includes(q) || a.creator.toLowerCase().includes(q)
    );
  }, [favorites, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let v = 0;
      if (sort === "title") v = a.title.localeCompare(b.title);
      if (sort === "artist") v = a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title);
      if (sort === "plays") {
        v = (pickStats.get(b.id)?.pickCount ?? 0) - (pickStats.get(a.id)?.pickCount ?? 0);
      }
      if (sort === "recent") {
        v = (pickStats.get(b.id)?.lastPickedTs ?? 0) - (pickStats.get(a.id)?.lastPickedTs ?? 0);
      }
      if (sort === "added") v = (b.added_at ?? 0) - (a.added_at ?? 0);
      return v * sortDir;
    });
  }, [filtered, sort, sortDir, pickStats]);

  function getGroupKey(item: Item): string {
    if (group === "artist") return item.creator;
    if (group === "genre") {
      try {
        const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;
        const genres = meta?.genres as string[] | undefined;
        if (genres && genres.length > 0) return genres[0];
      } catch {}
      return "Unknown";
    }
    return "All";
  }

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of sorted) {
      const key = getGroupKey(item);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, albums]) => ({ key, albums }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, group]);

  function handleSort(key: SortKey) {
    if (sort === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setSortDir(1);
    }
  }

  const handleRemove = (item: Item) => {
    setFavorites((prev) => prev.filter((i) => i.id !== item.id));
    setSelectedAlbumId(null);
  };

  return (
    <Layout>
      {/* Custom header */}
      <div
        className="sticky top-0 z-40 relative"
        style={{
          background: "rgba(15,10,12,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #3d2815",
        }}
      >
        <div className="max-w-xl lg:max-w-4xl mx-auto" style={{ padding: "10px 12px 9px" }}>
          {/* Title row */}
          <div className="flex items-center mb-2">
            <h1
              className="font-display flex-1 leading-none"
              style={{ fontSize: 22, color: "#f2e8d2", letterSpacing: "0.4em" }}
            >
              LIBRARY
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

          {/* Search bar */}
          <div
            className="flex items-center gap-1.5 mb-2"
            style={{
              border: "1px solid #3d2815",
              padding: "4px 8px",
              background: "#1a1210",
            }}
          >
            <span style={{ color: "#907558", fontSize: 11 }}>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search albums or artists"
              className="flex-1 bg-transparent border-none outline-none font-mono text-crate-text"
              style={{ fontSize: 11 }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="bg-transparent border-none cursor-pointer"
                style={{ color: "#907558", fontSize: 10 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort + Group controls */}
          <div className="flex gap-1 items-center flex-wrap">
            <span className="font-mono shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.12em" }}>
              SORT
            </span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className="font-mono shrink-0 cursor-pointer"
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  letterSpacing: "0.08em",
                  border: sort === key ? "1px solid #ff5e00" : "1px solid #3d2815",
                  background: sort === key ? "rgba(255,94,0,0.1)" : "transparent",
                  color: sort === key ? "#ff5e00" : "#907558",
                }}
              >
                {label}{sort === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
              </button>
            ))}

            <div className="shrink-0" style={{ width: 1, height: 10, background: "#3d2815", margin: "0 1px" }} />

            <span className="font-mono shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.12em" }}>
              GROUP
            </span>
            <select
              value={group}
              onChange={(e) => { setGroup(e.target.value as GroupKey); setSelectedAlbumId(null); }}
              className="font-mono cursor-pointer outline-none"
              style={{
                fontSize: 10,
                padding: "2px 4px",
                border: group !== "none" ? "1px solid #ff5e00" : "1px solid #3d2815",
                background: "#1a1210",
                color: group !== "none" ? "#ff5e00" : "#907558",
              }}
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      </div>

      {/* Shelf content */}
      <div style={{ paddingTop: 18, paddingBottom: 20 }}>
        {loading ? (
          <div style={{ padding: "0 12px" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="animate-pulse" style={{ height: 7, margin: "0 12px", background: "#2e1c0a" }} />
                <div className="animate-pulse" style={{ height: 138, margin: "0 12px", background: "#0e0609" }} />
                <div className="animate-pulse" style={{ height: 8, margin: "0 12px", background: "#221008" }} />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <VinylDisc size={56} />
            <p className="font-mono text-center" style={{ fontSize: 11, color: "#907558", opacity: 0.5 }}>
              {search ? "no albums match" : "no favorites yet — add some records"}
            </p>
          </div>
        ) : (
          grouped.map(({ key, albums }) => (
            <LibraryShelf
              key={key}
              albums={albums}
              spinesPerRow={SPINES_PER_ROW}
              groupLabel={group !== "none" ? key : undefined}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={setSelectedAlbumId}
              onRemoveAlbum={handleRemove}
              pickStats={pickStats}
              sortKey={sort}
            />
          ))
        )}
      </div>
    </Layout>
  );
}

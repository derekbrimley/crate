import React, { useState, useEffect, useMemo } from "react";
import { Layout } from "../components/Layout";
import { LibraryShelf } from "../components/library/LibraryShelf";
import { ProfileDropdown } from "../components/library/ProfileDropdown";
import { VinylDisc } from "../components/VinylDisc";
import { useDataCache } from "../contexts/DataCache";
import type { Item, CrateDefinition } from "../types";
import AdvancedFilters from "../components/library/AdvancedFilters";
import DuplicatesPanel from "../components/library/DuplicatesPanel";
import CoveragePanel from "../components/library/CoveragePanel";
import { findUncovered } from "../lib/coverage";
import { applyFilters, getItemGenres, ruleIsComplete, type FilterRule } from "../lib/filters";
import { everythingRule } from "../../lib/crates";
import { backfillReleaseDates } from "../services/api";
import { CrateEditorModal, makeEmptyCrate } from "../components/CrateEditorModal";
import { ProfileButton, SearchButton } from "../components/PageHeader";

const SPINES_PER_ROW = 14;

type SortKey = "title" | "artist" | "plays" | "recent" | "added";
type GroupKey = "none" | "artist" | "genre";
type ListFilter = "all" | "favorite" | "recommendation";

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

/**
 * A new crate that reproduces the Library's current view. The quick list
 * filter maps onto the crate's recommendations toggle; showing recommendations
 * only can't be expressed, so that view becomes favorites + recommendations.
 */
function crateFromLibraryView(
  position: number,
  rules: FilterRule[],
  matchMode: "AND" | "OR",
  listFilter: ListFilter
): CrateDefinition {
  const favoritesOnly =
    listFilter === "favorite" || rules.some((r) => r.field === "list" && r.value === "favorite");
  const kept = rules.filter((r) => r.field !== "list" && ruleIsComplete(r));
  return {
    ...makeEmptyCrate(position),
    // An unfiltered view is the whole library, which a crate spells "Everything".
    filters: { rules: kept.length > 0 ? kept : [everythingRule()], matchMode },
    include_recommendations: !favoritesOnly,
  };
}

/** Sort / list / group controls: touch-sized chips. */
const CHIP: React.CSSProperties = { fontSize: 13, padding: "8px 12px", minHeight: 40 };

interface ListsProps {
  onLogout: () => void;
}

export function Lists({ onLogout }: ListsProps) {
  const {
    favorites, setFavorites,
    recommendations, setRecommendations,
    listsLoaded, loadLists,
    pickStats,
    crateDefs, saveCrateDefs, crateMetaLoaded, loadCrateMeta,
  } = useDataCache();

  const [loading, setLoading] = useState(!listsLoaded);
  const [sort, setSort] = useState<SortKey>("artist");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [group, setGroup] = useState<GroupKey>("none");
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [matchMode, setMatchMode] = useState<"AND" | "OR">("AND");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [editing, setEditing] = useState<CrateDefinition | null>(null);

  // Crate definitions feed the coverage panel and "save as crate".
  useEffect(() => {
    if (!crateMetaLoaded) loadCrateMeta();
  }, [crateMetaLoaded, loadCrateMeta]);

  useEffect(() => {
    if (!listsLoaded) {
      setLoading(true);
      loadLists().finally(() => setLoading(false));
    }
  }, [listsLoaded, loadLists]);

  useEffect(() => {
    if (!listsLoaded) return;
    const hasMissing = [...favorites, ...recommendations].some((i) => {
      const m = (typeof i.metadata === "string" ? null : i.metadata) as Record<string, unknown> | null;
      return !m || !m.release_date || m.total_tracks === undefined;
    });
    if (!hasMissing) return;
    // Gate: run at most once per browser session
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("crate_backfill_done")) {
        return;
      }
    } catch {}
    let cancelled = false;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("crate_backfill_done", "1");
      }
    } catch {}
    backfillReleaseDates()
      .then((r) => {
        if (!cancelled && r.updated > 0) loadLists();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listsLoaded]);

  const allItems = useMemo(() => {
    if (listFilter === "favorite") return favorites;
    if (listFilter === "recommendation") return recommendations;
    return [...favorites, ...recommendations];
  }, [favorites, recommendations, listFilter]);

  const allLibraryItems = useMemo(
    () => [...favorites, ...recommendations],
    [favorites, recommendations]
  );

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) for (const g of getItemGenres(item)) set.add(g);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const uncovered = useMemo(
    () => findUncovered(allLibraryItems, crateDefs, pickStats),
    [allLibraryItems, crateDefs, pickStats]
  );

  const filtered = useMemo(() => {
    if (!search) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(
      (a) => a.title.toLowerCase().includes(q) || a.creator.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const ruleFiltered = useMemo(
    () => applyFilters(filtered, rules, matchMode, pickStats),
    [filtered, rules, matchMode, pickStats]
  );

  const sorted = useMemo(() => {
    return [...ruleFiltered].sort((a, b) => {
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
  }, [ruleFiltered, sort, sortDir, pickStats]);

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
    setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
    setSelectedAlbumId(null);
  };

  const handlePromote = (item: Item) => {
    setRecommendations((prev) => prev.filter((i) => i.id !== item.id));
    setFavorites((prev) => [...prev, { ...item, list_type: "favorite" as const }]);
  };

  const handleDuplicatesDeleted = (ids: number[]) => {
    const idSet = new Set(ids);
    setFavorites((prev) => prev.filter((i) => !idSet.has(i.id)));
    setRecommendations((prev) => prev.filter((i) => !idSet.has(i.id)));
  };

  return (
    <Layout>
      {/* Custom header */}
      <div
        className="sticky top-0 z-40 relative"
        style={{
          background: "rgb(var(--c-surface) / calc(0.97 * var(--tint)))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgb(var(--c-border))",
        }}
      >
        <div className="max-w-xl lg:max-w-4xl mx-auto" style={{ padding: "10px 12px 9px" }}>
          {/* Title row */}
          <div className="flex items-center mb-2">
            <h1
              className="font-display flex-1 leading-none"
              style={{ fontSize: 22, color: "rgb(var(--c-text))", letterSpacing: "0.4em" }}
            >
              LIBRARY
            </h1>
            <div className="flex items-center gap-2">
              <SearchButton />
              <ProfileButton open={showProfile} onClick={() => setShowProfile((v) => !v)} />
            </div>
          </div>

          {/* Search bar */}
          <div
            className="flex items-center gap-2 mb-3"
            style={{
              border: "1px solid rgb(var(--c-border))",
              padding: "0 4px 0 12px",
              minHeight: 48,
              background: "rgb(var(--c-elevated))",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" style={{ color: "rgb(var(--c-muted))" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {/* 16px text: iOS zooms the page when focusing anything smaller. */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search albums or artists"
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-crate-text"
              style={{ fontSize: 16, padding: "10px 0" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="flex items-center justify-center bg-transparent border-none cursor-pointer shrink-0"
                style={{ color: "rgb(var(--c-muted))", fontSize: 16, width: 40, height: 40 }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort + Group controls */}
          <div className="flex gap-x-1.5 gap-y-2 items-center flex-wrap">
            <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))", letterSpacing: "0.12em" }}>
              SORT
            </span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className="font-mono shrink-0 cursor-pointer"
                style={{
                  ...CHIP,
                  letterSpacing: "0.08em",
                  border: sort === key ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
                  background: sort === key ? "rgb(var(--c-accent) / calc(0.1 * var(--tint)))" : "transparent",
                  color: sort === key ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
                }}
              >
                {label}{sort === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
              </button>
            ))}

            <div className="shrink-0" style={{ width: 1, height: 20, background: "rgb(var(--c-border))", margin: "0 4px" }} />

            <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))", letterSpacing: "0.12em" }}>
              LIST
            </span>
            {([["all", "ALL"], ["favorite", "FAVORITES"], ["recommendation", "RECOMMENDATIONS"]] as [ListFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setListFilter(key); setSelectedAlbumId(null); }}
                className="font-mono shrink-0 cursor-pointer"
                style={{
                  ...CHIP,
                  letterSpacing: "0.08em",
                  border: listFilter === key ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
                  background: listFilter === key ? "rgb(var(--c-accent) / calc(0.1 * var(--tint)))" : "transparent",
                  color: listFilter === key ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
                }}
              >
                {label}
              </button>
            ))}

            <div className="shrink-0" style={{ width: 1, height: 20, background: "rgb(var(--c-border))", margin: "0 4px" }} />

            <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))", letterSpacing: "0.12em" }}>
              GROUP
            </span>
            <select
              value={group}
              onChange={(e) => { setGroup(e.target.value as GroupKey); setSelectedAlbumId(null); }}
              className="font-mono cursor-pointer outline-none"
              style={{
                ...CHIP,
                border: group !== "none" ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
                background: "rgb(var(--c-elevated))",
                color: group !== "none" ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
              }}
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <div className="shrink-0" style={{ width: 1, height: 20, background: "rgb(var(--c-border))", margin: "0 4px" }} />
            <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))", letterSpacing: "0.08em" }}>
              {ruleFiltered.length} {ruleFiltered.length === 1 ? "ALBUM" : "ALBUMS"}
            </span>
            <div className="shrink-0" style={{ width: 1, height: 20, background: "rgb(var(--c-border))", margin: "0 4px" }} />
            <button
              onClick={() => setShowDuplicates((v) => { setSelectedAlbumId(null); setShowCoverage(false); return !v; })}
              className="font-mono shrink-0 cursor-pointer"
              style={{
                ...CHIP,
                letterSpacing: "0.08em",
                border: showDuplicates ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
                background: showDuplicates ? "rgb(var(--c-accent) / calc(0.1 * var(--tint)))" : "transparent",
                color: showDuplicates ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
              }}
            >
              DUPLICATES
            </button>
            <button
              onClick={() => setShowCoverage((v) => { setSelectedAlbumId(null); setShowDuplicates(false); return !v; })}
              className="font-mono shrink-0 cursor-pointer"
              style={{
                ...CHIP,
                letterSpacing: "0.08em",
                border: showCoverage ? "1px solid rgb(var(--c-accent))" : "1px solid rgb(var(--c-border))",
                background: showCoverage ? "rgb(var(--c-accent) / calc(0.1 * var(--tint)))" : "transparent",
                color: showCoverage ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
              }}
            >
              GAPS
            </button>
            <button
              onClick={() => setEditing(crateFromLibraryView(crateDefs.length, rules, matchMode, listFilter))}
              className="font-mono shrink-0 cursor-pointer"
              style={{
                ...CHIP,
                letterSpacing: "0.08em",
                border: "1px solid rgb(var(--c-border))",
                background: "transparent",
                color: "rgb(var(--c-muted))",
              }}
            >
              SAVE AS CRATE
            </button>
          </div>
          <AdvancedFilters
            rules={rules}
            matchMode={matchMode}
            availableGenres={availableGenres}
            onChangeRules={(r) => { setRules(r); setSelectedAlbumId(null); }}
            onChangeMatchMode={setMatchMode}
            hiddenFields={["all"]}
            size="large"
          />
        </div>
        {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      </div>

      {/* Shelf content */}
      <div style={{ paddingTop: 18, paddingBottom: 20 }}>
        {showCoverage ? (
          <CoveragePanel albums={uncovered.albums} genres={uncovered.genres} onClose={() => setShowCoverage(false)} />
        ) : showDuplicates ? (
          <DuplicatesPanel
            items={allLibraryItems}
            pickStats={pickStats}
            onDeleted={handleDuplicatesDeleted}
            onClose={() => setShowDuplicates(false)}
          />
        ) : loading ? (
          <div style={{ padding: "0 12px" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="animate-pulse" style={{ height: 7, margin: "0 12px", background: "rgb(var(--c-wood))" }} />
                <div className="animate-pulse" style={{ height: 138, margin: "0 12px", background: "rgb(var(--c-shelf))" }} />
                <div className="animate-pulse" style={{ height: 8, margin: "0 12px", background: "rgb(var(--c-wood-dark))" }} />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <VinylDisc size={56} />
            <p className="font-mono text-center" style={{ fontSize: 11, color: "rgb(var(--c-muted))", opacity: 0.5 }}>
              {search ? "no albums match" : listFilter === "recommendation" ? "no recommendations yet" : listFilter === "favorite" ? "no favorites yet — add some records" : "no albums yet — add some records"}
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
              onPromoteAlbum={handlePromote}
              pickStats={pickStats}
              sortKey={sort}
            />
          ))
        )}
      </div>
      {editing && (
        <CrateEditorModal
          initial={editing}
          onSave={async (crate) => {
            try {
              await saveCrateDefs([...crateDefs, crate]);
              setEditing(null);
            } catch (err) {
              console.error("Failed to save crate:", err);
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Layout>
  );
}

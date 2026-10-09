import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { getCrateMeta, getAlbums, getHistory, saveCrates, updateConfig } from "../services/api";
import type { Item, PickHistoryEntry, PickStat, CrateDefinition } from "../types";

/** A frozen browse order: item ids, playable first, then resting (in cooldown). */
export interface RankOrder {
  ranked: number[];
  resting: number[];
}

interface DataCacheState {
  // Crate definitions + all-time play stats (GET /api/crates)
  crateDefs: CrateDefinition[];
  crateMetaLoaded: boolean;
  loadCrateMeta: () => Promise<void>;
  saveCrateDefs: (next: CrateDefinition[]) => Promise<void>;

  // Pick stats keyed by item id, plus the raw rows the ranking takes.
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  pickInfos: PickStat[];

  // Browse orders for the crate and Discover pages, keyed by page. Kept for
  // the session so going back and forth doesn't reshuffle a list.
  getRankOrder: (key: string) => RankOrder | undefined;
  setRankOrder: (key: string, order: RankOrder | undefined) => void;

  // Claude's suggestions, keyed by crate id or "discover". Kept for the
  // session: each fetch is a slow, paid Claude call.
  getCachedSuggestions: (key: string) => Item[] | undefined;
  setCachedSuggestions: (key: string, items: Item[] | undefined) => void;

  // Discover's "Claude suggestions" switch, stored in user config.
  discoverSuggestions: boolean;
  setDiscoverSuggestions: (on: boolean) => Promise<void>;

  // Lists
  favorites: Item[];
  recommendations: Item[];
  listsLoaded: boolean;
  loadLists: () => Promise<void>;
  setFavorites: React.Dispatch<React.SetStateAction<Item[]>>;
  setRecommendations: React.Dispatch<React.SetStateAction<Item[]>>;

  // History (raw pick log, used for History page display)
  history: PickHistoryEntry[];
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
}

const DataCacheContext = createContext<DataCacheState | null>(null);

function sortByPosition(crates: CrateDefinition[] | undefined): CrateDefinition[] {
  return (crates ?? []).slice().sort((a, b) => a.position - b.position);
}

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const [crateDefs, setCrateDefs] = useState<CrateDefinition[]>([]);
  const [crateMetaLoaded, setCrateMetaLoaded] = useState(false);
  const [pickInfos, setPickInfos] = useState<PickStat[]>([]);

  // A ref, not state: orders are written while rendering a list and read back
  // on the next visit, so changing one must not re-render anything.
  const rankOrders = useRef(new Map<string, RankOrder>());
  const suggestionCache = useRef(new Map<string, Item[]>());
  const [discoverSuggestions, setDiscoverSuggestionsState] = useState(false);

  // Lists state
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [recommendations, setRecommendations] = useState<Item[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);

  // History state
  const [history, setHistory] = useState<PickHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const pickStats = useMemo(() => {
    const map = new Map<number, { pickCount: number; lastPickedTs: number | null }>();
    for (const p of pickInfos) {
      map.set(p.item_id, { pickCount: Number(p.pick_count), lastPickedTs: p.picked_at });
    }
    return map;
  }, [pickInfos]);

  const loadCrateMeta = useCallback(async () => {
    try {
      const result = await getCrateMeta();
      if (result._config) {
        setCrateDefs(sortByPosition(result._config.crates));
        setDiscoverSuggestionsState(result._config.discover_ai_suggestions === true);
      }
      if (result._picks) setPickInfos(result._picks);
      setCrateMetaLoaded(true);
    } catch (err) {
      console.error("Failed to load crates:", err);
    }
  }, []);

  const saveCrateDefs = useCallback(async (next: CrateDefinition[]) => {
    const { config } = await saveCrates(next);
    setCrateDefs(sortByPosition(config.crates));
  }, []);

  const getRankOrder = useCallback((key: string) => rankOrders.current.get(key), []);
  const setRankOrder = useCallback((key: string, order: RankOrder | undefined) => {
    if (order) rankOrders.current.set(key, order);
    else rankOrders.current.delete(key);
  }, []);

  const getCachedSuggestions = useCallback((key: string) => suggestionCache.current.get(key), []);
  const setCachedSuggestions = useCallback((key: string, items: Item[] | undefined) => {
    if (items) suggestionCache.current.set(key, items);
    else suggestionCache.current.delete(key);
  }, []);

  const setDiscoverSuggestions = useCallback(async (on: boolean) => {
    setDiscoverSuggestionsState(on); // optimistic
    try {
      await updateConfig({ discover_ai_suggestions: on });
    } catch (err) {
      setDiscoverSuggestionsState(!on);
      console.error("Failed to save Discover setting:", err);
    }
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [favRes, recRes] = await Promise.all([
        getAlbums("favorite"),
        getAlbums("recommendation"),
      ]);
      setFavorites(favRes.items);
      setRecommendations(recRes.items);
      setListsLoaded(true);
    } catch (err) {
      console.error("Failed to load lists:", err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { history } = await getHistory(100);
      setHistory(history);
      setHistoryLoaded(true);
    } catch {}
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        crateDefs,
        crateMetaLoaded,
        loadCrateMeta,
        saveCrateDefs,
        pickStats,
        pickInfos,
        getRankOrder,
        setRankOrder,
        getCachedSuggestions,
        setCachedSuggestions,
        discoverSuggestions,
        setDiscoverSuggestions,
        favorites,
        recommendations,
        listsLoaded,
        loadLists,
        setFavorites,
        setRecommendations,
        history,
        historyLoaded,
        loadHistory,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error("useDataCache must be used within DataCacheProvider");
  return ctx;
}

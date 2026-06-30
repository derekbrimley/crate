import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { getDashboard, getDashboardCrate, getAlbums, getHistory, getConfig, saveCrates } from "../services/api";
import type { Item, DashboardData, AppConfig, PickHistoryEntry, PickStat, CrateDefinition } from "../types";

interface DataCacheState {
  // Dashboard
  cratesData: Map<string, Item[]>;
  crateDefs: CrateDefinition[];
  dashboardConfig: AppConfig | null;
  dashboardLoaded: boolean;
  // Crate ids whose results were deferred by the server (AI crates) and still
  // need a per-crate fetch.
  deferredCrates: Set<string>;
  loadDashboard: () => Promise<void>;
  refreshCrate: (crateId: string) => Promise<void>;
  saveCrateDefs: (next: CrateDefinition[]) => Promise<void>;
  loadConfig: () => Promise<void>;

  // Pick stats (all-time, from dashboard _picks)
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;

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

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  // Dashboard state
  const [cratesData, setCratesData] = useState<Map<string, Item[]>>(new Map());
  const [crateDefs, setCrateDefs] = useState<CrateDefinition[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<AppConfig | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [deferredCrates, setDeferredCrates] = useState<Set<string>>(new Set());
  const [rawPickStats, setRawPickStats] = useState<PickStat[]>([]);

  // Lists state
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [recommendations, setRecommendations] = useState<Item[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);

  // History state
  const [history, setHistory] = useState<PickHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const { config } = await getConfig();
      setDashboardConfig(config);
    } catch {}
  }, []);

  const pickStats = useMemo(() => {
    const map = new Map<number, { pickCount: number; lastPickedTs: number | null }>();
    for (const p of rawPickStats) {
      map.set(p.item_id, { pickCount: Number(p.pick_count), lastPickedTs: p.picked_at });
    }
    return map;
  }, [rawPickStats]);

  const loadDashboard = useCallback(async () => {
    try {
      const result = await getDashboard();
      if (result._config) {
        setDashboardConfig(result._config);
        setCrateDefs((result._config.crates ?? []).slice().sort((a, b) => a.position - b.position));
      }
      if (result._picks) setRawPickStats(result._picks);
      const map = new Map<string, Item[]>();
      const deferred = new Set<string>();
      for (const c of result.crates ?? []) {
        map.set(c.id, c.items);
        if (c.deferred) deferred.add(c.id);
      }
      setCratesData(map);
      setDeferredCrates(deferred);
      setDashboardLoaded(true);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
  }, []);

  const refreshCrate = useCallback(async (crateId: string) => {
    try {
      const result = await getDashboardCrate(crateId);
      const got = result.crates?.find((c) => c.id === crateId);
      if (got) {
        setCratesData((prev) => new Map(prev).set(crateId, got.items));
        setDeferredCrates((prev) => {
          if (!prev.has(crateId)) return prev;
          const next = new Set(prev);
          next.delete(crateId);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to refresh crate:", err);
    }
  }, []);

  const saveCrateDefs = useCallback(async (next: CrateDefinition[]) => {
    const { config } = await saveCrates(next);
    setDashboardConfig(config);
    setCrateDefs((config.crates ?? []).slice().sort((a, b) => a.position - b.position));
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
        cratesData,
        crateDefs,
        dashboardConfig,
        dashboardLoaded,
        deferredCrates,
        loadDashboard,
        refreshCrate,
        saveCrateDefs,
        loadConfig,
        pickStats,
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

import React, { createContext, useContext, useState, useCallback } from "react";
import { getDashboard, getDashboardMode, getAlbums, getHistory, getConfig } from "../services/api";
import type { Item, DashboardData, AppConfig, PickHistoryEntry } from "../types";

interface DataCacheState {
  // Dashboard
  dashboardData: DashboardData;
  dashboardConfig: AppConfig | null;
  dashboardLoaded: boolean;
  loadDashboard: (ctx?: string) => Promise<void>;
  refreshDashboardMode: (mode: string, ctx: string) => Promise<void>;
  loadConfig: () => Promise<void>;

  // Lists
  favorites: Item[];
  recommendations: Item[];
  listsLoaded: boolean;
  loadLists: () => Promise<void>;
  setFavorites: React.Dispatch<React.SetStateAction<Item[]>>;
  setRecommendations: React.Dispatch<React.SetStateAction<Item[]>>;

  // History
  history: PickHistoryEntry[];
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
}

const DataCacheContext = createContext<DataCacheState | null>(null);

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [dashboardConfig, setDashboardConfig] = useState<AppConfig | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

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

  const loadDashboard = useCallback(async (ctx?: string) => {
    try {
      const result = await getDashboard(ctx, ["surprise"]);
      if (result._config) setDashboardConfig(result._config);
      setDashboardData(result);
      setDashboardLoaded(true);

      const modes = result._config?.dashboard_modes as string[] | undefined;
      if (modes?.includes("surprise")) {
        getDashboardMode("surprise", ctx || "auto")
          .then((surpriseResult) => {
            setDashboardData((prev) => ({ ...prev, surprise: surpriseResult.surprise }));
          })
          .catch(() => {
            setDashboardData((prev) => ({ ...prev, surprise: [] }));
          });
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
  }, []);

  const refreshDashboardMode = useCallback(async (mode: string, ctx: string) => {
    try {
      const result = await getDashboardMode(mode, ctx);
      setDashboardData((prev) => ({ ...prev, [mode]: result[mode as keyof DashboardData] }));
    } catch (err) {
      console.error("Failed to refresh mode:", err);
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
        dashboardData,
        dashboardConfig,
        dashboardLoaded,
        loadDashboard,
        refreshDashboardMode,
        loadConfig,
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

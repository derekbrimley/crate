import { useEffect, useMemo, useRef } from "react";
import { useDataCache } from "../contexts/DataCache";

/**
 * Loads what the crate and Discover pages rank from: the library lists and the
 * crate definitions + play stats. Play stats are refreshed once per page visit
 * so "last played" stays current after listening; a refresh never reorders a
 * list that's already been shown.
 */
export function useLibraryData() {
  const cache = useDataCache();
  const { listsLoaded, loadLists, crateMetaLoaded, loadCrateMeta, favorites, recommendations } = cache;
  const refreshed = useRef(false);

  useEffect(() => {
    if (!listsLoaded) loadLists();
  }, [listsLoaded, loadLists]);

  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    loadCrateMeta();
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allItems = useMemo(() => [...favorites, ...recommendations], [favorites, recommendations]);

  return { ...cache, allItems, ready: listsLoaded && crateMetaLoaded };
}

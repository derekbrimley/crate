import { useCallback, useEffect, useMemo, useState } from "react";
import { useDataCache } from "../contexts/DataCache";
import { getSuggestions } from "../services/api";
import type { Item } from "../types";

/**
 * Claude's album suggestions for a crate (by id) or "discover", fetched when
 * `enabled` and cached for the session. Suggestions that have since been added
 * to the library drop out.
 */
export function useSuggestions(target: string, enabled: boolean) {
  const { getCachedSuggestions, setCachedSuggestions, favorites, recommendations } = useDataCache();
  const [items, setItems] = useState<Item[] | undefined>(() => getCachedSuggestions(target));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { suggestions } = await getSuggestions(target);
      setCachedSuggestions(target, suggestions);
      setItems(suggestions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [target, setCachedSuggestions]);

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedSuggestions(target);
    if (cached) setItems(cached);
    else void fetchSuggestions();
    // Fetch once per target while enabled; refresh() asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);

  const owned = useMemo(
    () => new Set([...favorites, ...recommendations].map((i) => i.external_id)),
    [favorites, recommendations]
  );
  const visible = (items ?? []).filter((i) => !owned.has(i.external_id));

  return { suggestions: visible, loading, error, refresh: fetchSuggestions };
}

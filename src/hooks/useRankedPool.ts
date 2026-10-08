import { useCallback, useMemo, useState } from "react";
import { useDataCache } from "../contexts/DataCache";
import { rankPool } from "../../lib/ranking";
import { applyRankOrder } from "../lib/crateBrowse";
import type { SelectionConfig } from "../../lib/selection";
import type { Item } from "../types";

/**
 * The whole pool in browse order: weighted-random playable items, then resting
 * ones. The order is made once per key and kept for the session (see
 * DataCache), so it only changes on reshuffle. Pass a null pool until the
 * library and play stats have loaded, so an empty order never gets frozen.
 */
export function useRankedPool(key: string, pool: Item[] | null, weighting: SelectionConfig) {
  const { getRankOrder, setRankOrder, pickInfos } = useDataCache();
  const [generation, setGeneration] = useState(0);

  const lists = useMemo(() => {
    if (!pool) return null;
    let order = getRankOrder(key);
    if (!order) {
      const { ranked, resting } = rankPool(pool, pickInfos, weighting);
      order = { ranked: ranked.map((i) => i.id), resting: resting.map((i) => i.id) };
      setRankOrder(key, order);
    }
    return applyRankOrder(order, pool);
    // pickInfos and weighting only matter when a new order is made, which
    // happens on first visit or reshuffle (generation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pool, generation]);

  const reshuffle = useCallback(() => {
    setRankOrder(key, undefined);
    setGeneration((g) => g + 1);
  }, [key, setRankOrder]);

  return { ranked: lists?.ranked ?? [], resting: lists?.resting ?? [], ready: lists !== null, reshuffle };
}

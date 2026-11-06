import { useCallback, useMemo, useState } from "react";
import { useDataCache } from "../contexts/DataCache";
import { rankPool, sortPool, type CrateSort } from "../../lib/ranking";
import { applyRankOrder } from "../lib/crateBrowse";
import type { SelectionConfig } from "../../lib/selection";
import type { Item } from "../types";

/**
 * The whole pool in browse order: playable items, then resting ones.
 *
 * With "shuffle" (the default) the order is weighted-random, made once per key
 * and kept for the session (see DataCache), so it only changes on reshuffle.
 * Any other sort is a plain sort, worked out from the current play stats every
 * time. Pass a null pool until the library and play stats have loaded, so an
 * empty order never gets frozen.
 */
export function useRankedPool(
  key: string,
  pool: Item[] | null,
  weighting: SelectionConfig,
  sort: CrateSort = "shuffle"
) {
  const { getRankOrder, setRankOrder, pickInfos } = useDataCache();
  const [generation, setGeneration] = useState(0);

  const lists = useMemo(() => {
    if (!pool) return null;
    if (sort !== "shuffle") return sortPool(pool, pickInfos, sort, weighting);
    let order = getRankOrder(key);
    if (!order) {
      const { ranked, resting } = rankPool(pool, pickInfos, weighting);
      order = { ranked: ranked.map((i) => i.id), resting: resting.map((i) => i.id) };
      setRankOrder(key, order);
    }
    return applyRankOrder(order, pool);
    // A shuffle reads pickInfos and weighting only when a new order is made,
    // which happens on first visit or reshuffle (generation). Plain sorts
    // follow pickInfos, which is refreshed once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pool, generation, sort, sort === "shuffle" ? null : pickInfos]);

  const reshuffle = useCallback(() => {
    setRankOrder(key, undefined);
    setGeneration((g) => g + 1);
  }, [key, setRankOrder]);

  return { ranked: lists?.ranked ?? [], resting: lists?.resting ?? [], ready: lists !== null, reshuffle };
}

import { applyFilters, type PickStat } from "./filters";
import { DEFAULT_WEIGHTING } from "../../lib/crates";
import type { SelectionConfig } from "../../lib/selection";
import type { Item, CrateDefinition } from "../types";

/**
 * Crates whose contents come from the library, i.e. everything except AI
 * "new music" crates and the friends crate. Only these get a crate page.
 */
export function isBrowsableCrate(crate: CrateDefinition): boolean {
  return crate.source === "library" && crate.strategy.type !== "ai_new";
}

/** Every library item the crate's filters let in. */
export function cratePool(crate: CrateDefinition, items: Item[], pickStats: Map<number, PickStat>): Item[] {
  return applyFilters(items, crate.filters.rules, crate.filters.matchMode, pickStats);
}

export function crateWeighting(crate: CrateDefinition): SelectionConfig {
  return "weighting" in crate.strategy ? crate.strategy.weighting : DEFAULT_WEIGHTING;
}

/**
 * Lays a frozen order over the current pool. Items that have left the pool are
 * skipped, and items added since the order was made go at the end of the
 * playable list.
 */
export function applyRankOrder(
  order: { ranked: number[]; resting: number[] },
  pool: Item[]
): { ranked: Item[]; resting: Item[] } {
  const byId = new Map(pool.map((i) => [i.id, i]));
  const placed = new Set<number>();
  const take = (ids: number[]) =>
    ids.flatMap((id) => {
      const item = byId.get(id);
      if (!item || placed.has(id)) return [];
      placed.add(id);
      return [item];
    });
  const ranked = take(order.ranked);
  const resting = take(order.resting);
  const added = pool.filter((i) => !placed.has(i.id));
  return { ranked: [...ranked, ...added], resting };
}

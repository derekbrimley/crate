import type { Item, CrateDefinition } from "../types";
import { applyFilters, getItemGenres, type PickStat } from "../../lib/filters";

// A crate contributes to coverage only when its membership is defined by
// filters over the library: weighted, random, or ai_pool from source "library".
// ai_new/hybrid draw non-deterministically (or from outside the library) and
// friends crates have no library pool, so they never count toward coverage.
function hasDeterministicPool(crate: CrateDefinition): boolean {
  if (crate.source !== "library") return false;
  const t = crate.strategy.type;
  return t === "weighted" || t === "random" || t === "ai_pool";
}

export function findUncovered(
  items: Item[],
  crateDefs: CrateDefinition[],
  pickStats: Map<number, PickStat>
): { albums: Item[]; genres: string[] } {
  const coveredIds = new Set<number>();
  for (const crate of crateDefs) {
    if (!hasDeterministicPool(crate)) continue;
    const pool = applyFilters(items, crate.filters.rules, crate.filters.matchMode, pickStats);
    for (const it of pool) coveredIds.add(it.id);
  }

  const albums = items.filter((it) => !coveredIds.has(it.id));

  // A genre is covered if at least one album carrying it is covered.
  const coveredGenres = new Set<string>();
  const allGenres = new Set<string>();
  for (const it of items) {
    const genres = getItemGenres(it);
    const isCovered = coveredIds.has(it.id);
    for (const g of genres) {
      allGenres.add(g);
      if (isCovered) coveredGenres.add(g);
    }
  }
  const genres = Array.from(allGenres)
    .filter((g) => !coveredGenres.has(g))
    .sort((a, b) => a.localeCompare(b));

  return { albums, genres };
}

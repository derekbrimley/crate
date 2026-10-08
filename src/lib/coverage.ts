import type { Item, CrateDefinition } from "../types";
import { getItemGenres, type PickStat } from "../../lib/filters";
import { cratePool } from "../../lib/crates";

export function findUncovered(
  items: Item[],
  crateDefs: CrateDefinition[],
  pickStats: Map<number, PickStat>
): { albums: Item[]; genres: string[] } {
  const coveredIds = new Set<number>();
  for (const crate of crateDefs) {
    for (const it of cratePool(crate, items, pickStats)) coveredIds.add(it.id);
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

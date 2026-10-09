import { cratePool, DEFAULT_WEIGHTING, normalizeCrates, type CrateDefinition } from "./crates";
import type { PickStat } from "./filters";
import { rankPool } from "./ranking";
import type { Item, LastPickInfo } from "./types";

export interface Shelf {
  id: string;
  name: string;
  items: Item[];
}

export const DEFAULT_SHELF_SIZE = 8;
export const MAX_SHELF_SIZE = 24;

/**
 * Every crate as a short shelf of picks, for devices that can't rank on their
 * own (the kitchen dashboard). Same pool and the same weighted-random order the
 * crate page shows, cut to `size`; if too few records are playable right now,
 * resting ones fill the rest, least recently played first.
 */
export function buildShelves(
  rawCrates: unknown,
  items: Item[],
  picks: LastPickInfo[],
  size = DEFAULT_SHELF_SIZE
): Shelf[] {
  const n = Math.max(1, Math.min(MAX_SHELF_SIZE, Math.floor(size) || DEFAULT_SHELF_SIZE));
  const stats = new Map<number, PickStat>(
    picks.map((p) => [p.item_id, { pickCount: Number(p.pick_count), lastPickedTs: p.picked_at }])
  );
  const crates: CrateDefinition[] = [...normalizeCrates(rawCrates).crates].sort((a, b) => a.position - b.position);
  return crates
    .filter((c) => c.name.trim())
    .map((c) => {
      const pool = cratePool(c, items, stats);
      const { ranked, resting } = rankPool(pool, picks, DEFAULT_WEIGHTING);
      return { id: c.id, name: c.name, items: [...ranked, ...resting].slice(0, n) };
    });
}

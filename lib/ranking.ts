import type { Item, LastPickInfo } from "./types";
import { selectAlbums, type SelectionConfig } from "./selection";

/**
 * Orders a whole pool for browsing: everything playable now in weighted-random
 * order, then everything still in its cooldown ("resting"), least recently
 * played first. Nothing in the pool is dropped.
 */
export function rankPool(
  pool: Item[],
  picks: LastPickInfo[],
  weighting: SelectionConfig
): { ranked: Item[]; resting: Item[] } {
  const ranked = selectAlbums(pool, pool.length, picks, weighting);
  const rankedIds = new Set(ranked.map((i) => i.id));
  const lastPicked = new Map(picks.map((p) => [p.item_id, p.picked_at]));
  const resting = pool
    .filter((i) => !rankedIds.has(i.id))
    .sort((a, b) => (lastPicked.get(a.id) ?? 0) - (lastPicked.get(b.id) ?? 0));
  return { ranked, resting };
}

/**
 * Discover leans hard toward what you haven't heard: never-played
 * recommendations get a large bonus, and the longer since a play the heavier
 * the weight.
 */
export const DISCOVER_WEIGHTING: SelectionConfig = {
  cooldown_days: 3,
  weight_recent_days: 14,
  weight_medium_days: 45,
  weight_low: 1,
  weight_medium: 3,
  weight_high: 6,
  weight_never_picked_bonus: 10,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

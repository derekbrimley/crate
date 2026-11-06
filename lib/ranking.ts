import type { Item, LastPickInfo } from "./types";
import { selectAlbums, type SelectionConfig } from "./selection";

/** How a crate page orders its records. */
export type CrateSort = "unplayed" | "least_played" | "most_played" | "added" | "artist" | "shuffle";

export const CRATE_SORTS: { key: CrateSort; label: string }[] = [
  { key: "unplayed", label: "Longest unplayed" },
  { key: "least_played", label: "Fewest plays" },
  { key: "most_played", label: "Most plays" },
  { key: "added", label: "Recently added" },
  { key: "artist", label: "Artist A–Z" },
  { key: "shuffle", label: "Shuffle" },
];

export const DEFAULT_CRATE_SORT: CrateSort = "unplayed";

export function isCrateSort(v: unknown): v is CrateSort {
  return CRATE_SORTS.some((s) => s.key === v);
}

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

type Stats = Map<number, { picked_at: number; count: number }>;

function compareFor(sort: Exclude<CrateSort, "shuffle">, stats: Stats): (a: Item, b: Item) => number {
  const last = (i: Item) => stats.get(i.id)?.picked_at ?? null;
  const count = (i: Item) => stats.get(i.id)?.count ?? 0;
  const byName = (a: Item, b: Item) => a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title);
  // Never played first (the longest-waiting, i.e. earliest added, leading),
  // then least recently played.
  const unplayed = (a: Item, b: Item) => {
    const la = last(a);
    const lb = last(b);
    if (la === null && lb === null) return (a.added_at ?? 0) - (b.added_at ?? 0) || byName(a, b);
    if (la === null) return -1;
    if (lb === null) return 1;
    return la - lb || byName(a, b);
  };
  switch (sort) {
    case "unplayed": return unplayed;
    case "least_played": return (a, b) => count(a) - count(b) || unplayed(a, b);
    case "most_played": return (a, b) => count(b) - count(a) || unplayed(a, b);
    case "added": return (a, b) => (b.added_at ?? 0) - (a.added_at ?? 0) || byName(a, b);
    case "artist": return byName;
  }
}

/**
 * Orders a pool by `sort`. Every sort keeps the same split as `rankPool`:
 * records playable now first, then those still in cooldown. "shuffle" is the
 * weighted-random order; the rest are plain sorts, applied within each half.
 */
export function sortPool(
  pool: Item[],
  picks: LastPickInfo[],
  sort: CrateSort,
  weighting: SelectionConfig
): { ranked: Item[]; resting: Item[] } {
  if (sort === "shuffle") return rankPool(pool, picks, weighting);
  const stats: Stats = new Map(picks.map((p) => [p.item_id, { picked_at: p.picked_at, count: Number(p.pick_count) }]));
  const cutoff = Math.floor(Date.now() / 1000) - weighting.cooldown_days * 86400;
  const compare = compareFor(sort, stats);
  const ranked: Item[] = [];
  const resting: Item[] = [];
  for (const item of pool) {
    const last = stats.get(item.id)?.picked_at;
    (last !== undefined && last > cutoff ? resting : ranked).push(item);
  }
  return { ranked: ranked.sort(compare), resting: resting.sort(compare) };
}

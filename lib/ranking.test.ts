import { describe, it, expect } from "vitest";
import { rankPool, DISCOVER_WEIGHTING } from "./ranking";
import { DEFAULT_WEIGHTING } from "./crates";
import type { Item, LastPickInfo } from "./types";

function item(id: number): Item {
  return {
    id, user_id: 1, media_type: "album", list_type: "favorite",
    title: `T${id}`, creator: "A", image_url: null, external_id: `x${id}`,
    external_uri: null, external_url: null, added_at: 0, metadata: null,
  };
}

const now = Math.floor(Date.now() / 1000);
const daysAgo = (d: number) => now - d * 86400;

describe("rankPool", () => {
  it("keeps every item exactly once", () => {
    const pool = [1, 2, 3, 4, 5].map(item);
    const picks: LastPickInfo[] = [{ item_id: 2, picked_at: daysAgo(1), pick_count: 1 }];
    const { ranked, resting } = rankPool(pool, picks, DEFAULT_WEIGHTING);
    const ids = [...ranked, ...resting].map((i) => i.id).sort();
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts items in cooldown last, least recently played first", () => {
    const pool = [1, 2, 3].map(item);
    const picks: LastPickInfo[] = [
      { item_id: 2, picked_at: daysAgo(0.1), pick_count: 1 },
      { item_id: 3, picked_at: daysAgo(2), pick_count: 4 },
    ];
    const { ranked, resting } = rankPool(pool, picks, DEFAULT_WEIGHTING); // 3-day cooldown
    expect(ranked.map((i) => i.id)).toEqual([1]);
    expect(resting.map((i) => i.id)).toEqual([3, 2]);
  });

  it("handles an empty pool", () => {
    expect(rankPool([], [], DEFAULT_WEIGHTING)).toEqual({ ranked: [], resting: [] });
  });

  it("Discover tends to put never-played items first", () => {
    const pool = [item(1), item(2)];
    // Item 1 played long ago, item 2 never.
    const picks: LastPickInfo[] = [{ item_id: 1, picked_at: daysAgo(100), pick_count: 3 }];
    let neverPlayedFirst = 0;
    for (let i = 0; i < 400; i++) {
      if (rankPool(pool, picks, DISCOVER_WEIGHTING).ranked[0].id === 2) neverPlayedFirst++;
    }
    // Weights are 16 vs 6, so the never-played item leads well over half the time.
    expect(neverPlayedFirst).toBeGreaterThan(240);
  });
});

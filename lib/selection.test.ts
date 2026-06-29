import { describe, it, expect, vi, afterEach } from "vitest";
import { selectAlbums, type SelectionConfig } from "./selection";
import type { Item } from "./types";

function item(over: Partial<Item>): Item {
  return {
    id: 1, user_id: 1, media_type: "album", list_type: "favorite",
    title: "T", creator: "A", image_url: null, external_id: "x",
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

const base: SelectionConfig = {
  cooldown_days: 0,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 1,
  weight_high: 1,
  weight_never_picked_bonus: 0,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

afterEach(() => vi.restoreAllMocks());

describe("selectAlbums recently-added bonus", () => {
  it("with zero bonus, never returns more than the pool size", () => {
    const pool = [item({ id: 1 }), item({ id: 2 })];
    const res = selectAlbums(pool, 5, [], base);
    expect(res.length).toBe(2);
  });

  it("a recently-added album with a large bonus is overwhelmingly favored", () => {
    // Freeze randomness so weighting, not chance, decides.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const now = Math.floor(Date.now() / 1000);
    const old = item({ id: 1, added_at: now - 60 * 86400 });   // added 60 days ago
    const fresh = item({ id: 2, added_at: now - 1 * 86400 });  // added yesterday
    const cfg: SelectionConfig = { ...base, recently_added_days: 14, recently_added_bonus: 100 };
    const [first] = selectAlbums([old, fresh], 1, [], cfg);
    expect(first.id).toBe(2);
  });

  it("recently-added bonus does not apply to albums added long ago", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const now = Math.floor(Date.now() / 1000);
    const a = item({ id: 1, added_at: now - 60 * 86400 });
    const b = item({ id: 2, added_at: now - 60 * 86400 });
    const cfg: SelectionConfig = { ...base, recently_added_bonus: 100 };
    const res = selectAlbums([a, b], 2, [], cfg);
    expect(res.map((i) => i.id).sort()).toEqual([1, 2]); // both eligible, neither boosted out of range
  });
});

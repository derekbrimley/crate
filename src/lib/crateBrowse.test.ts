import { describe, it, expect } from "vitest";
import { applyRankOrder, isBrowsableCrate, cratePool } from "./crateBrowse";
import type { Item, CrateDefinition } from "../types";

function item(id: number, over: Partial<Item> = {}): Item {
  return {
    id, user_id: 1, media_type: "album", list_type: "favorite",
    title: `T${id}`, creator: "A", image_url: null, external_id: `x${id}`,
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

function crate(over: Partial<CrateDefinition>): CrateDefinition {
  return {
    id: "c", name: "C", position: 0, source: "library", count: 4,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "random" },
    ...over,
  };
}

describe("applyRankOrder", () => {
  it("keeps the frozen order", () => {
    const pool = [item(1), item(2), item(3)];
    const out = applyRankOrder({ ranked: [3, 1], resting: [2] }, pool);
    expect(out.ranked.map((i) => i.id)).toEqual([3, 1]);
    expect(out.resting.map((i) => i.id)).toEqual([2]);
  });

  it("drops removed items and appends new ones to the playable list", () => {
    const pool = [item(1), item(3), item(4)];
    const out = applyRankOrder({ ranked: [2, 1], resting: [3] }, pool);
    expect(out.ranked.map((i) => i.id)).toEqual([1, 4]);
    expect(out.resting.map((i) => i.id)).toEqual([3]);
  });
});

describe("isBrowsableCrate", () => {
  it("excludes friends and AI new-music crates", () => {
    expect(isBrowsableCrate(crate({}))).toBe(true);
    expect(isBrowsableCrate(crate({ strategy: { type: "ai_pool" } }))).toBe(true);
    expect(isBrowsableCrate(crate({ strategy: { type: "ai_new" } }))).toBe(false);
    expect(isBrowsableCrate(crate({ source: "friends" }))).toBe(false);
  });
});

describe("cratePool", () => {
  it("applies the crate's filters", () => {
    const items = [item(1), item(2, { list_type: "recommendation" })];
    const favs = crate({
      filters: { rules: [{ id: "r1", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
    });
    expect(cratePool(favs, items, new Map()).map((i) => i.id)).toEqual([1]);
  });
});

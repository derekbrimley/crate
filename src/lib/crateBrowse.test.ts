import { describe, it, expect } from "vitest";
import { applyRankOrder } from "./crateBrowse";
import type { Item } from "../types";

function item(id: number, over: Partial<Item> = {}): Item {
  return {
    id, user_id: 1, media_type: "album", list_type: "favorite",
    title: `T${id}`, creator: "A", image_url: null, external_id: `x${id}`,
    external_uri: null, external_url: null, added_at: 0, metadata: null,
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

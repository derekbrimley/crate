import { describe, expect, it } from "vitest";
import { buildShelves } from "./shelves";
import { everythingRule, makeEmptyCrate } from "./crates";
import type { Item } from "./types";

const item = (id: number, title: string, list: Item["list_type"] = "favorite"): Item => ({
  id, user_id: 1, media_type: "album", list_type: list, title, creator: "x", image_url: null,
  external_id: `e${id}`, external_uri: `spotify:album:e${id}`, external_url: null, added_at: 0, metadata: null,
});

describe("buildShelves", () => {
  const items = [item(1, "A"), item(2, "B"), item(3, "C"), item(4, "R", "recommendation")];
  const everything = { ...makeEmptyCrate(1), id: "all", name: "Everything", filters: { rules: [everythingRule()], matchMode: "AND" as const } };
  const hand = { ...makeEmptyCrate(0), id: "hand", name: "Hand picked", include_ids: [2, 4] };
  const unnamed = { ...makeEmptyCrate(2), id: "blank", include_ids: [1] };

  it("orders crates by position, skips unnamed ones, keeps hand-added recommendations", () => {
    const shelves = buildShelves([everything, hand, unnamed], items, [], 8);
    expect(shelves.map((s) => s.id)).toEqual(["hand", "all"]);
    expect(shelves[0].items.map((i) => i.id).sort()).toEqual([2, 4]);
    expect(shelves[1].items.map((i) => i.id).sort()).toEqual([1, 2, 3]);
  });

  it("cuts to the requested size and fills with resting records when needed", () => {
    const now = Math.floor(Date.now() / 1000);
    const picks = [{ item_id: 1, picked_at: now - 3600, pick_count: 1 }]; // A is in cooldown
    const shelves = buildShelves([everything], items, picks, 3);
    expect(shelves[0].items).toHaveLength(3);
    expect(shelves[0].items[2].id).toBe(1); // resting one comes last
    expect(buildShelves([everything], items, picks, 2)[0].items).toHaveLength(2);
  });

  it("clamps silly sizes", () => {
    expect(buildShelves([everything], items, [], 0)[0].items).toHaveLength(3);
    expect(buildShelves([everything], items, [], 999)[0].items).toHaveLength(3);
  });
});

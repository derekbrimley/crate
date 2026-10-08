import { describe, it, expect } from "vitest";
import {
  cratePool, crateMembership, toggleMembership, normalizeCrates, seedCrates, makeEmptyCrate, everythingRule,
  type CrateDefinition,
} from "./crates";
import type { Item } from "./types";

function item(id: number, over: Partial<Item> = {}): Item {
  return {
    id, user_id: 1, media_type: "album", list_type: "favorite",
    title: `T${id}`, creator: "A", image_url: null, external_id: `x${id}`,
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

const jazz = { genres: ["jazz"] };
const items = [
  item(1, { metadata: jazz }),
  item(2, { metadata: { genres: ["rock"] } }),
  item(3, { list_type: "recommendation", metadata: jazz }),
  item(4, { media_type: "playlist" }),
];
const stats = new Map();

function crate(over: Partial<CrateDefinition>): CrateDefinition {
  return { ...makeEmptyCrate(0), id: "c", name: "C", ...over };
}

const jazzRule = { rules: [{ id: "r", field: "genre" as const, operator: "is", value: "jazz" }], matchMode: "AND" as const };
const everything = { rules: [everythingRule()], matchMode: "AND" as const };
const ids = (xs: Item[]) => xs.map((i) => i.id);

describe("cratePool", () => {
  it("with the Everything rule, holds every favorite (and recommendations when on)", () => {
    expect(ids(cratePool(crate({ filters: everything }), items, stats))).toEqual([1, 2, 4]);
    expect(ids(cratePool(crate({ filters: everything, include_recommendations: true }), items, stats))).toEqual([1, 2, 3, 4]);
  });

  it("with no rules, holds only hand-picked records", () => {
    expect(ids(cratePool(crate({}), items, stats))).toEqual([]);
    expect(ids(cratePool(crate({ include_ids: [3] }), items, stats))).toEqual([3]);
  });

  it("treats a crate whose only rule is blank as having no rules", () => {
    const blank = { rules: [{ id: "r", field: "genre" as const, operator: "is", value: "" }], matchMode: "AND" as const };
    expect(ids(cratePool(crate({ filters: blank }), items, stats))).toEqual([]);
  });

  it("includes recommendations only when toggled on", () => {
    expect(ids(cratePool(crate({ filters: jazzRule }), items, stats))).toEqual([1]);
    expect(ids(cratePool(crate({ filters: jazzRule, include_recommendations: true }), items, stats))).toEqual([1, 3]);
  });

  it("adds hand-picked items (recommendations too) and leaves out excluded ones", () => {
    const c = crate({ filters: jazzRule, include_ids: [4, 3], exclude_ids: [1] });
    expect(ids(cratePool(c, items, stats))).toEqual([4, 3]);
  });

  it("skips hand-picked ids that are no longer in the library", () => {
    expect(ids(cratePool(crate({ include_ids: [99, 2] }), items, stats))).toEqual([2]);
  });
});

describe("toggleMembership", () => {
  const c = crate({ filters: jazzRule });

  it("adds a non-member by hand, and takes it back out", () => {
    const added = toggleMembership(c, items[1], stats);
    expect(added.include_ids).toEqual([2]);
    expect(crateMembership(added, items[1], stats)).toBe("hand");
    expect(toggleMembership(added, items[1], stats).include_ids).toEqual([]);
  });

  it("leaves out a filter match, and puts it back", () => {
    expect(crateMembership(c, items[0], stats)).toBe("filter");
    const out = toggleMembership(c, items[0], stats);
    expect(out.exclude_ids).toEqual([1]);
    expect(crateMembership(out, items[0], stats)).toBe("excluded");
    expect(toggleMembership(out, items[0], stats).exclude_ids).toEqual([]);
  });
});

describe("normalizeCrates", () => {
  const W = { cooldown_days: 3 };
  const old = [
    { id: "fav", name: "Favorites", position: 0, source: "library", count: 4,
      filters: { rules: [{ id: "r1", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
      strategy: { type: "weighted", weighting: W } },
    { id: "disc", name: "Discover", position: 1, source: "library", count: 4,
      filters: { rules: [{ id: "r1", field: "list", operator: "is", value: "recommendation" }], matchMode: "AND" },
      strategy: { type: "weighted", weighting: W } },
    { id: "sur", name: "Surprise Me", position: 2, source: "library", count: 4,
      filters: { rules: [], matchMode: "AND" }, strategy: { type: "ai_new" } },
    { id: "jazz", name: "Jazz", position: 3, source: "library", count: 4,
      filters: jazzRule, strategy: { type: "ai_pool", prompt: "late night" } },
    { id: "fr", name: "From Friends", position: 4, source: "friends", count: 4,
      filters: { rules: [], matchMode: "AND" }, strategy: { type: "random" } },
  ];

  it("converts old crates, dropping the Discover and friends crates", () => {
    const { crates, changed } = normalizeCrates(old);
    expect(changed).toBe(true);
    expect(crates.map((c) => c.name)).toEqual(["Favorites", "Surprise Me", "Jazz"]);
    expect(crates[0]).toEqual({
      id: "fav", name: "Favorites", position: 0,
      filters: { rules: [everythingRule()], matchMode: "AND" },
      include_recommendations: false, include_ids: [], exclude_ids: [], ai_suggestions: false,
    });
    expect(crates[2].include_recommendations).toBe(true);
    expect(crates[2].position).toBe(2);
  });

  it("keeps Claude suggestions on for AI new-music crates, without library rules", () => {
    const surprise = normalizeCrates(old).crates[1];
    expect(surprise.ai_suggestions).toBe(true);
    expect(surprise.filters.rules).toEqual([]);
  });

  it("turns a pool-picking AI crate into a plain filtered crate", () => {
    const jazz = normalizeCrates(old).crates[2];
    expect(jazz.ai_suggestions).toBe(false);
    expect(jazz.filters).toEqual(jazzRule);
  });

  it("leaves current crates alone, whatever their key order", () => {
    const current = normalizeCrates(old).crates;
    // JSONB hands keys back in its own order.
    const shuffled = current.map((c) => Object.fromEntries(Object.entries(c).reverse()));
    const again = normalizeCrates(shuffled);
    expect(again.changed).toBe(false);
    expect(again.crates).toEqual(current);
  });

  it("keeps a recommendations-only crate that has hand-picked items", () => {
    const hand = [{ ...crate({ include_ids: [3] }), filters: { rules: [{ id: "r", field: "list", operator: "is", value: "recommendation" }], matchMode: "AND" } }];
    expect(normalizeCrates(hand).crates).toHaveLength(1);
  });
});

describe("seedCrates", () => {
  it("starts with Favorites and genre moods, all in the current shape", () => {
    const seeds = seedCrates();
    expect(seeds[0].name).toBe("Favorites");
    expect(seeds[0].include_recommendations).toBe(false);
    expect(seeds[0].filters.rules).toEqual([everythingRule()]);
    expect(seeds.some((c) => c.ai_suggestions)).toBe(true);
    expect(seeds.length).toBeGreaterThan(1);
    expect(normalizeCrates(seeds).changed).toBe(false);
  });
});

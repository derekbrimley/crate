import { describe, it, expect, vi } from "vitest";
import { runCrate, buildPickStats, type CrateEngineDeps } from "./crateEngine";
import type { CrateDefinition } from "./crates";
import { DEFAULT_WEIGHTING } from "./crates";
import type { Item, LastPickInfo } from "./types";

function item(over: Partial<Item>): Item {
  return {
    id: 1, user_id: 1, media_type: "album", list_type: "favorite",
    title: "T", creator: "A", image_url: null, external_id: "x",
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

const library = [
  item({ id: 1, list_type: "favorite", metadata: { genres: ["rock"] } }),
  item({ id: 2, list_type: "recommendation", metadata: { genres: ["jazz"] } }),
  item({ id: 3, list_type: "favorite", metadata: { genres: ["jazz"] } }),
];

const noDeps: CrateEngineDeps = {
  aiPoolPick: vi.fn(),
  aiNewPick: vi.fn(),
  friendPicks: vi.fn(),
};

function crate(over: Partial<CrateDefinition>): CrateDefinition {
  return {
    id: "c1", name: "C", position: 0, source: "library", count: 2,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "random" },
    ...over,
  };
}

describe("buildPickStats", () => {
  it("maps LastPickInfo to PickStat shape", () => {
    const picks: LastPickInfo[] = [{ item_id: 1, picked_at: 100, pick_count: 3 }];
    const m = buildPickStats(picks);
    expect(m.get(1)).toEqual({ pickCount: 3, lastPickedTs: 100 });
  });
});

describe("runCrate filtering", () => {
  it("random strategy returns up to count items from the filtered pool", async () => {
    const c = crate({
      filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
      strategy: { type: "random" },
      count: 5,
    });
    const res = await runCrate(c, library, [], noDeps);
    expect(res.map((i) => i.id).sort()).toEqual([1, 3]); // only favorites
  });

  it("weighted strategy respects the filtered pool", async () => {
    const c = crate({
      filters: { rules: [{ id: "r", field: "genre", operator: "is", value: "jazz" }], matchMode: "AND" },
      strategy: { type: "weighted", weighting: DEFAULT_WEIGHTING },
      count: 5,
    });
    const res = await runCrate(c, library, [], noDeps);
    expect(res.map((i) => i.id).sort()).toEqual([2, 3]);
  });
});

describe("runCrate strategies dispatch to deps", () => {
  it("ai_pool calls aiPoolPick with the filtered pool", async () => {
    const aiPoolPick = vi.fn().mockResolvedValue([library[0]]);
    const c = crate({
      filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
      strategy: { type: "ai_pool", prompt: "rainy day" },
      count: 1,
    });
    const res = await runCrate(c, library, [], { ...noDeps, aiPoolPick });
    expect(aiPoolPick).toHaveBeenCalledWith("rainy day", expect.arrayContaining([library[0], library[2]]), 1);
    expect(res).toEqual([library[0]]);
  });

  it("ai_new calls aiNewPick with the full library", async () => {
    const aiNewPick = vi.fn().mockResolvedValue([item({ id: 99 })]);
    const c = crate({ strategy: { type: "ai_new", prompt: "energetic" }, count: 3 });
    const res = await runCrate(c, library, [], { ...noDeps, aiNewPick });
    expect(aiNewPick).toHaveBeenCalledWith("energetic", library, 3);
    expect(res[0].id).toBe(99);
  });

  it("ai_pool falls back to a local pick when the dep throws", async () => {
    const aiPoolPick = vi.fn().mockRejectedValue(new Error("nope"));
    const c = crate({
      filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
      strategy: { type: "ai_pool" },
      count: 5,
    });
    const res = await runCrate(c, library, [], { ...noDeps, aiPoolPick });
    expect(res.map((i) => i.id).sort()).toEqual([1, 3]); // fell back to filtered pool
  });

  it("ai_new falls back to a local pick from the full library when the dep throws", async () => {
    const aiNewPick = vi.fn().mockRejectedValue(new Error("nope"));
    const c = crate({
      filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
      strategy: { type: "ai_new" },
      count: 5,
    });
    const res = await runCrate(c, library, [], { ...noDeps, aiNewPick });
    // Fallback draws from the FULL library (3 items), not just the 2 filtered favorites.
    expect(res.length).toBe(3);
  });

  it("source=friends calls friendPicks and ignores filters", async () => {
    const friendPicks = vi.fn().mockResolvedValue([item({ id: 7 })]);
    const c = crate({ source: "friends", count: 4, filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" } });
    const res = await runCrate(c, library, [], { ...noDeps, friendPicks });
    expect(friendPicks).toHaveBeenCalledWith(4);
    expect(res[0].id).toBe(7);
  });
});

import { describe, it, expect } from "vitest";
import { findUncovered } from "./coverage";
import type { Item, CrateDefinition } from "../types";

function item(id: number, list: "favorite" | "recommendation", genres: string[]): Item {
  return {
    id,
    title: `t${id}`,
    creator: `c${id}`,
    list_type: list,
    external_id: `e${id}`,
    image_url: null,
    external_uri: null,
    external_url: null,
    added_at: 0,
    metadata: { genres },
  } as unknown as Item;
}

function crate(id: string, partial: Partial<CrateDefinition>): CrateDefinition {
  return {
    id,
    name: id,
    position: 0,
    source: "library",
    count: 4,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "weighted", weighting: {} as never },
    ...partial,
  } as CrateDefinition;
}

const stats = new Map();

describe("findUncovered", () => {
  it("treats a catch-all (empty rules) library crate as covering everything", () => {
    const items = [item(1, "favorite", ["rock"]), item(2, "recommendation", ["jazz"])];
    const crates = [crate("c1", {})];
    const { albums, genres } = findUncovered(items, crates, stats);
    expect(albums.length).toBe(0);
    expect(genres.length).toBe(0);
  });

  it("returns albums matching no crate filter as uncovered", () => {
    const items = [item(1, "favorite", ["rock"]), item(2, "recommendation", ["jazz"])];
    // Crate only covers favorites
    const crates = [crate("c1", { filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" } })];
    const { albums } = findUncovered(items, crates, stats);
    expect(albums.map((a) => a.id)).toEqual([2]);
  });

  it("marks a genre uncovered only when every album with it is uncovered", () => {
    const items = [item(1, "favorite", ["rock"]), item(2, "recommendation", ["rock", "jazz"])];
    const crates = [crate("c1", { filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" } })];
    const { genres } = findUncovered(items, crates, stats);
    // rock is covered (item 1). jazz only on uncovered item 2 -> uncovered.
    expect(genres).toEqual(["jazz"]);
  });

  it("ignores ai_new, hybrid, and friends crates for coverage", () => {
    const items = [item(1, "favorite", ["rock"])];
    const crates = [
      crate("c1", { strategy: { type: "ai_new" } as never }),
      crate("c2", { source: "friends", strategy: { type: "random" } as never }),
    ];
    const { albums } = findUncovered(items, crates, stats);
    expect(albums.map((a) => a.id)).toEqual([1]);
  });
});

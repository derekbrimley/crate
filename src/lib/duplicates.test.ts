import { describe, it, expect } from "vitest";
import { normalizeArtist, normalizeTitle, findDuplicateGroups } from "./duplicates";
import type { Item } from "../types";

function item(over: Partial<Item>): Item {
  return {
    id: 1, user_id: 1, media_type: "album", list_type: "favorite",
    title: "T", creator: "Artist", image_url: null, external_id: "x",
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

describe("normalizeArtist", () => {
  it("lowercases, trims, collapses whitespace and strips punctuation", () => {
    expect(normalizeArtist("  The  Beatles!  ")).toBe("the beatles");
  });
});

describe("normalizeTitle", () => {
  it("normalizes like artist", () => {
    expect(normalizeTitle("  Abbey   Road  ")).toBe("abbey road");
  });
  it("strips parenthetical edition suffixes", () => {
    expect(normalizeTitle("Nevermind (Deluxe Edition)")).toBe("nevermind");
    expect(normalizeTitle("OK Computer (Remastered)")).toBe("ok computer");
    expect(normalizeTitle("Blue (Expanded Edition)")).toBe("blue");
    expect(normalizeTitle("Rumours (Bonus Track Version)")).toBe("rumours");
  });
  it("strips dash remaster suffixes", () => {
    expect(normalizeTitle("Thriller - 2011 Remaster")).toBe("thriller");
    expect(normalizeTitle("Kind of Blue - Remastered 2009")).toBe("kind of blue");
  });
});

describe("findDuplicateGroups", () => {
  it("groups items sharing an external_id as exact", () => {
    const items = [
      item({ id: 1, external_id: "abc" }),
      item({ id: 2, external_id: "abc" }),
      item({ id: 3, external_id: "zzz" }),
    ];
    const groups = findDuplicateGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchType).toBe("exact");
    expect(groups[0].items.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("groups different ids with same normalized title+artist as fuzzy", () => {
    const items = [
      item({ id: 1, external_id: "a1", title: "Nevermind", creator: "Nirvana" }),
      item({ id: 2, external_id: "a2", title: "Nevermind (Deluxe Edition)", creator: "Nirvana" }),
    ];
    const groups = findDuplicateGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchType).toBe("fuzzy");
    expect(groups[0].items.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("does not re-flag exact-matched items as fuzzy", () => {
    const items = [
      item({ id: 1, external_id: "same", title: "X", creator: "Y" }),
      item({ id: 2, external_id: "same", title: "X", creator: "Y" }),
    ];
    const groups = findDuplicateGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchType).toBe("exact");
  });

  it("does not fuzzy-match same title with different artist", () => {
    const items = [
      item({ id: 1, external_id: "a1", title: "Greatest Hits", creator: "Queen" }),
      item({ id: 2, external_id: "a2", title: "Greatest Hits", creator: "ABBA" }),
    ];
    expect(findDuplicateGroups(items)).toHaveLength(0);
  });

  it("excludes singletons", () => {
    const items = [
      item({ id: 1, external_id: "a1", title: "Alone", creator: "Solo" }),
    ];
    expect(findDuplicateGroups(items)).toHaveLength(0);
  });
});

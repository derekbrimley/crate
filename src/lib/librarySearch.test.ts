import { describe, it, expect } from "vitest";
import { matchLibrary } from "./librarySearch";
import type { Item } from "../types";

function item(id: number, title: string, creator: string): Item {
  return {
    id, user_id: 1, media_type: "album", list_type: "favorite", title, creator,
    image_url: null, external_id: `x${id}`, external_uri: null, external_url: null, added_at: 0, metadata: null,
  };
}

const items = [
  item(1, "Blue Train", "John Coltrane"),
  item(2, "Blue", "Joni Mitchell"),
  item(3, "Kind of Blue", "Miles Davis"),
  item(4, "Court and Spark", "Joni Mitchell"),
];

describe("matchLibrary", () => {
  it("returns nothing for an empty query", () => {
    expect(matchLibrary(items, "  ")).toEqual([]);
  });

  it("matches every word across title and artist, in any order", () => {
    expect(matchLibrary(items, "joni blue").map((i) => i.id)).toEqual([2]);
    expect(matchLibrary(items, "MITCHELL").map((i) => i.id)).toEqual([2, 4]);
  });

  it("lists title matches before artist-only matches", () => {
    const withArtist = [...items, item(5, "Hejira", "Blue Rodeo")];
    expect(matchLibrary(withArtist, "blue").map((i) => i.id)).toEqual([1, 2, 3, 5]);
  });
});

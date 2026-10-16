import { describe, it, expect } from "vitest";
import { applyFilters, getItemYear, getItemGenres, getItemSavedTs, isMissingMetadata, FIELD_DEFS } from "./filters";
import type { Item } from "../types";

function item(over: Partial<Item>): Item {
  return {
    id: 1, user_id: 1, media_type: "album", list_type: "favorite",
    title: "T", creator: "Artist", image_url: null, external_id: "x",
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

const NO_STATS = new Map();

describe("getItemYear", () => {
  it("parses year from release_date", () => {
    expect(getItemYear(item({ metadata: { release_date: "1973-03-01" } }))).toBe(1973);
  });
  it("parses year-only release_date", () => {
    expect(getItemYear(item({ metadata: { release_date: "1991" } }))).toBe(1991);
  });
  it("returns null when missing", () => {
    expect(getItemYear(item({ metadata: null }))).toBeNull();
  });
  it("handles stringified metadata", () => {
    expect(getItemYear(item({ metadata: '{"release_date":"1984-01-01"}' as any }))).toBe(1984);
  });
});

describe("getItemGenres", () => {
  it("reads genres array", () => {
    expect(getItemGenres(item({ metadata: { genres: ["rock", "jazz"] } }))).toEqual(["rock", "jazz"]);
  });
  it("returns [] when missing", () => {
    expect(getItemGenres(item({ metadata: null }))).toEqual([]);
  });
});

describe("applyFilters - year", () => {
  const items = [
    item({ id: 1, metadata: { release_date: "1973-01-01" } }),
    item({ id: 2, metadata: { release_date: "1985-01-01" } }),
    item({ id: 3, metadata: { release_date: "2001-01-01" } }),
    item({ id: 4, metadata: null }),
  ];
  it("is", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "is", value: "1985" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([2]);
  });
  it("between (inclusive)", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "between", value: "1970", value2: "1990" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([1, 2]);
  });
  it("before", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "before", value: "1990" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([1, 2]);
  });
  it("after", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "after", value: "1990" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([3]);
  });
  it("excludes items with no year", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "after", value: "1000" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it("ignores non-numeric value", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "is", value: "-" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([]);
  });
  it("ignores non-numeric value2 in between", () => {
    const r = applyFilters(items, [{ id: "a", field: "year", operator: "between", value: "1970", value2: "-" }], "AND", NO_STATS);
    expect(r.map((i) => i.id)).toEqual([]);
  });
});

describe("applyFilters - genre / artist / list / plays", () => {
  const items = [
    item({ id: 1, creator: "Pink Floyd", list_type: "favorite", metadata: { genres: ["rock"] } }),
    item({ id: 2, creator: "Miles Davis", list_type: "recommendation", metadata: { genres: ["jazz"] } }),
  ];
  const stats = new Map([[1, { pickCount: 5, lastPickedTs: null }], [2, { pickCount: 1, lastPickedTs: null }]]);

  it("genre is", () => {
    expect(applyFilters(items, [{ id: "a", field: "genre", operator: "is", value: "jazz" }], "AND", stats).map((i) => i.id)).toEqual([2]);
  });
  it("genre is_not", () => {
    expect(applyFilters(items, [{ id: "a", field: "genre", operator: "is_not", value: "jazz" }], "AND", stats).map((i) => i.id)).toEqual([1]);
  });
  it("artist contains (case-insensitive)", () => {
    expect(applyFilters(items, [{ id: "a", field: "artist", operator: "contains", value: "floyd" }], "AND", stats).map((i) => i.id)).toEqual([1]);
  });
  it("list is", () => {
    expect(applyFilters(items, [{ id: "a", field: "list", operator: "is", value: "recommendation" }], "AND", stats).map((i) => i.id)).toEqual([2]);
  });
  it("plays gte", () => {
    expect(applyFilters(items, [{ id: "a", field: "plays", operator: "gte", value: "3" }], "AND", stats).map((i) => i.id)).toEqual([1]);
  });
});

describe("applyFilters - combining", () => {
  const items = [
    item({ id: 1, creator: "A", metadata: { release_date: "1980-01-01", genres: ["rock"] } }),
    item({ id: 2, creator: "B", metadata: { release_date: "1980-01-01", genres: ["jazz"] } }),
    item({ id: 3, creator: "C", metadata: { release_date: "2010-01-01", genres: ["rock"] } }),
  ];
  const rules = [
    { id: "a", field: "year" as const, operator: "before", value: "2000" },
    { id: "b", field: "genre" as const, operator: "is", value: "rock" },
  ];
  it("AND", () => {
    expect(applyFilters(items, rules, "AND", new Map()).map((i) => i.id)).toEqual([1]);
  });
  it("OR", () => {
    expect(applyFilters(items, rules, "OR", new Map()).map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it("no rules returns all", () => {
    expect(applyFilters(items, [], "AND", new Map()).map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it("ignores incomplete rules (empty value)", () => {
    expect(applyFilters(items, [{ id: "a", field: "year", operator: "is", value: "" }], "AND", new Map()).map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe("FIELD_DEFS", () => {
  it("between needs value2 only for year between", () => {
    expect(FIELD_DEFS.year.needsValue2?.("between")).toBe(true);
    expect(FIELD_DEFS.year.needsValue2?.("is")).toBe(false);
  });
});

describe("type filter", () => {
  const items = [
    item({ id: 1, metadata: { album_type: "album" } }),
    item({ id: 2, metadata: { album_type: "compilation" } }),
    item({ id: 3, media_type: "playlist" }),
    item({ id: 4 }),
  ];
  const run = (operator: string, value: string) =>
    applyFilters(items, [{ id: "r", field: "type", operator, value }], "AND", NO_STATS).map((i) => i.id);

  it("matches the stored album_type, and playlists as playlist", () => {
    expect(run("is", "compilation")).toEqual([2]);
    expect(run("is", "playlist")).toEqual([3]);
  });

  it("is not keeps records with no stored type", () => {
    expect(run("is_not", "compilation")).toEqual([1, 3, 4]);
  });
});

describe("explicit filter", () => {
  const items = [
    item({ id: 1, metadata: { explicit: true } }),
    item({ id: 2, metadata: { explicit: false } }),
    item({ id: 3 }),
  ];
  const run = (operator: string) =>
    applyFilters(items, [{ id: "r", field: "explicit", operator, value: "" }], "AND", NO_STATS).map((i) => i.id);

  it("needs no value and leaves out records with no answer", () => {
    expect(run("yes")).toEqual([1]);
    expect(run("no")).toEqual([2]);
  });
});

describe("saved filter", () => {
  const now = Date.now() / 1000;
  const day = 86400;
  const iso = (ts: number) => new Date(ts * 1000).toISOString();

  it("uses the earlier of the Spotify save date and the Crate add date", () => {
    const saved = now - 400 * day;
    expect(getItemSavedTs(item({ added_at: now, metadata: { saved_at: iso(saved) } }))).toBeCloseTo(saved, 0);
    expect(getItemSavedTs(item({ added_at: now - 10 * day, metadata: { saved_at: iso(now) } }))).toBe(now - 10 * day);
    expect(getItemSavedTs(item({ added_at: 123, metadata: { saved_at: null } }))).toBe(123);
  });

  it("finds forgotten favorites alongside last played", () => {
    const items = [
      item({ id: 1, added_at: now, metadata: { saved_at: iso(now - 500 * day) } }),
      item({ id: 2, added_at: now - 500 * day }),
      item({ id: 3, added_at: now - 20 * day }),
    ];
    const stats = new Map([[2, { pickCount: 1, lastPickedTs: now - 5 * day }]]);
    const ids = applyFilters(
      items,
      [
        { id: "a", field: "saved", operator: "more_than_days_ago", value: "365" },
        { id: "b", field: "last_played", operator: "more_than_days_ago", value: "180" },
      ],
      "AND",
      stats
    ).map((i) => i.id);
    expect(ids).toEqual([1]);
  });
});

describe("isMissingMetadata", () => {
  const full = { release_date: "1999", total_tracks: 10, album_type: "album", explicit: false, saved_at: null };

  it("counts null as looked up, and skips playlists", () => {
    expect(isMissingMetadata(item({ metadata: full }))).toBe(false);
    expect(isMissingMetadata(item({ metadata: { ...full, saved_at: undefined } }))).toBe(true);
    expect(isMissingMetadata(item({ metadata: null }))).toBe(true);
    expect(isMissingMetadata(item({ media_type: "playlist" }))).toBe(false);
  });
});

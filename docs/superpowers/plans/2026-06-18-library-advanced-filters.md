# Library Advanced Filters (incl. release year) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic Advanced Filters rule builder to the Library tab, with release-year filtering backed by Spotify release-date data persisted on every album.

**Architecture:** Two parts. (A) Persist Spotify `release_date` into each `item.metadata` — on single add (reuse the existing album fetch), on bulk add (one batch call), and a one-time backfill endpoint for existing items. (B) A pure filter engine (`src/lib/filters.ts`) driven by a `FIELD_DEFS` table, a builder UI component (`AdvancedFilters.tsx`), and wiring into `Lists.tsx`'s existing `useMemo` chain.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind; Vercel serverless functions; Supabase Postgres; Spotify Web API. Vitest (added in Task 1) for unit-testing the pure filter logic.

## Global Constraints

- **Serverless function cap: 12 per deployment.** Currently 10. This plan adds exactly one new endpoint (`api/albums/backfill.ts`) → 11. Do not create additional API files.
- All API routes authenticate via `getAuthenticatedUser(req.headers.authorization)` and return `401 { error: "Unauthorized" }` when it returns null.
- `metadata` is a JSONB column on `items`; existing keys (e.g. `genres`) must be preserved when writing `release_date`.
- Release date is stored as Spotify's raw `release_date` string (`YYYY-MM-DD`, or `YYYY`, or `YYYY-MM`). Year is derived as `release_date.slice(0, 4)`.
- Client filtering is done entirely on cached `Item` rows from `DataCache`. No server-side filtering.
- Match existing Library control styling: `font-mono`, 10px, accent `#ff5e00`, border `#3d2815`, inactive text `#907558`, panel bg `#1a1210`.

---

## File Structure

- **Create** `src/lib/filters.ts` — pure filter engine: `FieldKey`, `FilterRule`, `FIELD_DEFS`, `applyFilters`, `getItemYear`, `getItemGenres`.
- **Create** `src/lib/filters.test.ts` — Vitest unit tests for the engine.
- **Create** `src/components/library/AdvancedFilters.tsx` — the rule-builder UI.
- **Create** `api/albums/backfill.ts` — one-time release-date backfill endpoint.
- **Modify** `lib/spotify.ts` — add `fetchAlbumMeta`; refactor `fetchAlbumGenres` to delegate.
- **Modify** `lib/queries.ts` — add `updateItemMetadata`, `getItemsMissingReleaseDate`.
- **Modify** `api/albums/index.ts` — store `release_date` on single add.
- **Modify** `api/albums/bulk.ts` — store `release_date` on bulk add.
- **Modify** `src/services/api.ts` — add `backfillReleaseDates` client call.
- **Modify** `src/pages/Lists.tsx` — state + `applyFilters` wiring + render `AdvancedFilters` + trigger backfill on load.
- **Modify** `package.json` — add Vitest dev dep + `test` script.

---

## Task 1: Add Vitest and the pure filter engine

**Files:**
- Modify: `package.json`
- Create: `src/lib/filters.ts`
- Test: `src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `Item` from `src/types` (has `creator`, `list_type`, `metadata`).
- Produces:
  - `type FieldKey = "year" | "genre" | "artist" | "list" | "plays"`
  - `interface FilterRule { id: string; field: FieldKey; operator: string; value: string; value2?: string }`
  - `interface PickStat { pickCount: number; lastPickedTs: number | null }`
  - `FIELD_DEFS: Record<FieldKey, FieldDef>` where `FieldDef = { label: string; operators: { key: string; label: string }[]; valueType: "number" | "text" | "genre" | "list"; needsValue2?: (op: string) => boolean }`
  - `getItemYear(item: Item): number | null`
  - `getItemGenres(item: Item): string[]`
  - `applyFilters(items: Item[], rules: FilterRule[], matchMode: "AND" | "OR", pickStats: Map<number, PickStat>): Item[]`
  - `makeRuleId(seed: number): string`

- [ ] **Step 1: Add Vitest dev dependency and test script**

Run:
```bash
npm install -D vitest
```

Then edit `package.json` `scripts` to add (keep existing scripts):
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyFilters, getItemYear, getItemGenres, FIELD_DEFS } from "./filters";
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./filters"` / module not found.

- [ ] **Step 4: Write the implementation**

Create `src/lib/filters.ts`:
```ts
import type { Item } from "../types";

export type FieldKey = "year" | "genre" | "artist" | "list" | "plays";

export interface FilterRule {
  id: string;
  field: FieldKey;
  operator: string;
  value: string;
  value2?: string;
}

export interface PickStat {
  pickCount: number;
  lastPickedTs: number | null;
}

interface FieldDef {
  label: string;
  operators: { key: string; label: string }[];
  valueType: "number" | "text" | "genre" | "list";
  needsValue2?: (op: string) => boolean;
}

export const FIELD_DEFS: Record<FieldKey, FieldDef> = {
  year: {
    label: "Year",
    operators: [
      { key: "is", label: "is" },
      { key: "between", label: "is between" },
      { key: "before", label: "before" },
      { key: "after", label: "after" },
    ],
    valueType: "number",
    needsValue2: (op) => op === "between",
  },
  genre: {
    label: "Genre",
    operators: [
      { key: "is", label: "is" },
      { key: "is_not", label: "is not" },
    ],
    valueType: "genre",
  },
  artist: {
    label: "Artist",
    operators: [
      { key: "is", label: "is" },
      { key: "contains", label: "contains" },
    ],
    valueType: "text",
  },
  list: {
    label: "List",
    operators: [{ key: "is", label: "is" }],
    valueType: "list",
  },
  plays: {
    label: "Plays",
    operators: [
      { key: "gte", label: "≥" },
      { key: "lte", label: "≤" },
      { key: "is", label: "is" },
    ],
    valueType: "number",
  },
};

function parseMeta(item: Item): Record<string, unknown> {
  const m = item.metadata;
  if (!m) return {};
  if (typeof m === "string") {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return m;
}

export function getItemYear(item: Item): number | null {
  const rd = parseMeta(item).release_date as string | undefined;
  if (!rd || rd.length < 4) return null;
  const y = parseInt(rd.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function getItemGenres(item: Item): string[] {
  const g = parseMeta(item).genres;
  return Array.isArray(g) ? (g as string[]) : [];
}

export function makeRuleId(seed: number): string {
  return `rule-${seed}`;
}

function ruleIsComplete(rule: FilterRule): boolean {
  if (rule.value.trim() === "") return false;
  if (FIELD_DEFS[rule.field].needsValue2?.(rule.operator) && (rule.value2 ?? "").trim() === "") {
    return false;
  }
  return true;
}

function evaluate(item: Item, rule: FilterRule, pickStats: Map<number, PickStat>): boolean {
  switch (rule.field) {
    case "year": {
      const y = getItemYear(item);
      if (y === null) return false;
      const v = parseInt(rule.value, 10);
      if (rule.operator === "is") return y === v;
      if (rule.operator === "before") return y < v;
      if (rule.operator === "after") return y > v;
      if (rule.operator === "between") {
        const v2 = parseInt(rule.value2 ?? "", 10);
        const lo = Math.min(v, v2);
        const hi = Math.max(v, v2);
        return y >= lo && y <= hi;
      }
      return false;
    }
    case "genre": {
      const genres = getItemGenres(item).map((g) => g.toLowerCase());
      const target = rule.value.toLowerCase();
      const has = genres.includes(target);
      return rule.operator === "is_not" ? !has : has;
    }
    case "artist": {
      const a = item.creator.toLowerCase();
      const target = rule.value.toLowerCase();
      return rule.operator === "contains" ? a.includes(target) : a === target;
    }
    case "list":
      return item.list_type === rule.value;
    case "plays": {
      const count = pickStats.get(item.id)?.pickCount ?? 0;
      const v = parseInt(rule.value, 10);
      if (rule.operator === "gte") return count >= v;
      if (rule.operator === "lte") return count <= v;
      if (rule.operator === "is") return count === v;
      return false;
    }
    default:
      return false;
  }
}

export function applyFilters(
  items: Item[],
  rules: FilterRule[],
  matchMode: "AND" | "OR",
  pickStats: Map<number, PickStat>
): Item[] {
  const active = rules.filter(ruleIsComplete);
  if (active.length === 0) return items;
  return items.filter((item) => {
    if (matchMode === "AND") return active.every((r) => evaluate(item, r, pickStats));
    return active.some((r) => evaluate(item, r, pickStats));
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/filters.ts src/lib/filters.test.ts
git commit -m "feat: add pure filter engine + vitest"
```

---

## Task 2: Persist release_date in Spotify lib + queries

**Files:**
- Modify: `lib/spotify.ts` (near `fetchAlbumGenres`, ~line 314-330)
- Modify: `lib/queries.ts` (add two exports)

**Interfaces:**
- Consumes: `spotifyPublicFetch`, `SpotifyAlbumDetail`, `getArtistGenres`, `getAlbumsBatch` (existing in `lib/spotify.ts`); `supabaseAdmin`, `Item` (existing in `lib/queries.ts`).
- Produces:
  - `lib/spotify.ts`: `fetchAlbumMeta(albumId: string): Promise<{ genres: string[]; release_date: string | null }>`
  - `lib/queries.ts`: `updateItemMetadata(userId: number, itemId: number, metadata: Record<string, unknown>): Promise<void>`
  - `lib/queries.ts`: `getItemsMissingReleaseDate(userId: number): Promise<Item[]>`

- [ ] **Step 1: Add `fetchAlbumMeta` and refactor `fetchAlbumGenres` in `lib/spotify.ts`**

Replace the existing `fetchAlbumGenres` function with:
```ts
export async function fetchAlbumMeta(
  albumId: string
): Promise<{ genres: string[]; release_date: string | null }> {
  // Single album fetch gives us artist IDs (for genres) and the release date.
  const albumRes = await spotifyPublicFetch(`/albums/${albumId}?fields=artists(id),release_date`);
  if (!albumRes.ok) throw new Error(`Failed to fetch album: ${albumRes.status}`);
  const albumData = (await albumRes.json()) as SpotifyAlbumDetail & { release_date?: string };
  const release_date = albumData.release_date ?? null;

  const artistIds = albumData.artists.map((a) => a.id).filter(Boolean);
  if (artistIds.length === 0) return { genres: [], release_date };

  const params = new URLSearchParams({ ids: artistIds.slice(0, 50).join(",") });
  const artistRes = await spotifyPublicFetch(`/artists?${params}`);
  if (!artistRes.ok) throw new Error(`Failed to fetch artists: ${artistRes.status}`);
  const artistData = (await artistRes.json()) as { artists: SpotifyArtistDetail[] };

  const genres = new Set<string>();
  for (const artist of artistData.artists ?? []) {
    for (const g of artist.genres ?? []) genres.add(g);
  }
  return { genres: Array.from(genres), release_date };
}

export async function fetchAlbumGenres(albumId: string): Promise<string[]> {
  return (await fetchAlbumMeta(albumId)).genres;
}
```

Note: `SpotifyAlbumDetail` is `{ artists: { id: string }[] }`. The `?fields=` includes `release_date`; we widen the cast inline.

- [ ] **Step 2: Add `updateItemMetadata` and `getItemsMissingReleaseDate` to `lib/queries.ts`**

Append:
```ts
export async function updateItemMetadata(
  userId: number,
  itemId: number,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("items")
    .update({ metadata })
    .eq("user_id", userId)
    .eq("id", itemId);
  if (error) throw error;
}

export async function getItemsMissingReleaseDate(userId: number): Promise<Item[]> {
  const { data, error } = await supabaseAdmin
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .eq("media_type", "album");
  if (error) throw error;
  const items = (data ?? []) as Item[];
  return items.filter((i) => {
    const m = i.metadata as Record<string, unknown> | null;
    return !m || !m.release_date;
  });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts lib/queries.ts
git commit -m "feat: fetch release_date from spotify + item metadata query helpers"
```

---

## Task 3: Store release_date on album add (single + bulk)

**Files:**
- Modify: `api/albums/index.ts` (POST branch, ~lines 37-60)
- Modify: `api/albums/bulk.ts` (~lines 27-40)

**Interfaces:**
- Consumes: `fetchAlbumMeta` (Task 2), `getAlbumsBatch` (existing), `bulkAddItems`/`addItem` (existing).
- Produces: items inserted with `metadata.release_date` when available. No new exports.

- [ ] **Step 1: Update single-add to store release_date in `api/albums/index.ts`**

Replace the metadata-building block (currently using `fetchAlbumGenres`) with:
```ts
    // Fetch artist genres + release date from Spotify (best-effort — don't block the add if it fails)
    let metadata: Record<string, unknown> = {};
    if (genres?.length) metadata.genres = genres;

    try {
      const meta = await fetchAlbumMeta(spotify_id);
      if (meta.genres.length > 0) metadata.genres = meta.genres;
      if (meta.release_date) metadata.release_date = meta.release_date;
    } catch {
      // Spotify metadata unavailable — album still gets added without it
    }
```

And update the import line:
```ts
import { fetchAlbumMeta } from "../../lib/spotify";
```
(replacing the `fetchAlbumGenres` import).

- [ ] **Step 2: Update bulk-add to store release_date in `api/albums/bulk.ts`**

Add import at top:
```ts
import { getAlbumsBatch } from "../../lib/spotify";
```

Replace the `rows` construction (currently a plain `.map`) with a batch-fetch of release dates first:
```ts
  // Best-effort: fetch release dates from Spotify (20 ids per request)
  const releaseDates = new Map<string, string>();
  try {
    for (let i = 0; i < albums.length; i += 20) {
      const chunk = albums.slice(i, i + 20).map((a) => a.spotify_id);
      const fetched = await getAlbumsBatch(chunk);
      for (const alb of fetched) {
        if (alb?.id && alb.release_date) releaseDates.set(alb.id, alb.release_date);
      }
    }
  } catch {
    // Spotify unavailable — albums still get added without release dates
  }

  const rows = albums.map((a) => {
    const rd = releaseDates.get(a.spotify_id);
    return {
      title: a.title,
      creator: a.artist,
      image_url: a.image_url ?? null,
      external_id: a.spotify_id,
      external_uri: a.spotify_uri ?? null,
      external_url: a.spotify_url ?? null,
      metadata: rd ? { release_date: rd } : null,
    };
  });
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add api/albums/index.ts api/albums/bulk.ts
git commit -m "feat: store release_date when adding albums"
```

---

## Task 4: Backfill endpoint + client call

**Files:**
- Create: `api/albums/backfill.ts`
- Modify: `src/services/api.ts` (add one function)

**Interfaces:**
- Consumes: `getAuthenticatedUser` (existing), `getItemsMissingReleaseDate` + `updateItemMetadata` (Task 2), `getAlbumsBatch` (existing).
- Produces:
  - Endpoint `POST /api/albums/backfill` → `{ updated: number }`.
  - `src/services/api.ts`: `backfillReleaseDates(): Promise<{ updated: number }>`.

- [ ] **Step 1: Create `api/albums/backfill.ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getItemsMissingReleaseDate, updateItemMetadata } from "../../lib/queries";
import { getAlbumsBatch } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const items = await getItemsMissingReleaseDate(user.id);
  if (items.length === 0) return res.json({ updated: 0 });

  // Map external_id -> item so we can merge metadata back.
  const byExternalId = new Map(items.map((i) => [i.external_id, i]));
  const releaseDates = new Map<string, string>();

  try {
    const ids = items.map((i) => i.external_id);
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const fetched = await getAlbumsBatch(chunk);
      for (const alb of fetched) {
        if (alb?.id && alb.release_date) releaseDates.set(alb.id, alb.release_date);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify fetch failed", detail: message });
  }

  let updated = 0;
  for (const [externalId, rd] of releaseDates) {
    const item = byExternalId.get(externalId);
    if (!item) continue;
    const existing = (item.metadata as Record<string, unknown> | null) ?? {};
    await updateItemMetadata(user.id, item.id, { ...existing, release_date: rd });
    updated++;
  }

  res.json({ updated });
}
```

- [ ] **Step 2: Add the client call to `src/services/api.ts`**

The file uses a `request<T>(path, options)` helper where `path` is relative to `/api` (it prepends `BASE = "/api"`). Add near the other album functions:
```ts
export async function backfillReleaseDates(): Promise<{ updated: number }> {
  return request<{ updated: number }>("/albums/backfill", { method: "POST" });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build`
Expected: builds clean. Confirm function count: `find api -name "*.ts" | wc -l` returns 11 (≤ 12).

- [ ] **Step 4: Commit**

```bash
git add api/albums/backfill.ts src/services/api.ts
git commit -m "feat: add release-date backfill endpoint + client call"
```

---

## Task 5: AdvancedFilters builder component

**Files:**
- Create: `src/components/library/AdvancedFilters.tsx`

**Interfaces:**
- Consumes: `FilterRule`, `FieldKey`, `FIELD_DEFS`, `makeRuleId` (Task 1).
- Produces: default export `AdvancedFilters` with props:
  ```ts
  interface AdvancedFiltersProps {
    rules: FilterRule[];
    matchMode: "AND" | "OR";
    availableGenres: string[];
    onChangeRules: (rules: FilterRule[]) => void;
    onChangeMatchMode: (m: "AND" | "OR") => void;
  }
  ```

- [ ] **Step 1: Create `src/components/library/AdvancedFilters.tsx`**

```tsx
import React, { useState } from "react";
import { FIELD_DEFS, makeRuleId } from "../../lib/filters";
import type { FilterRule, FieldKey } from "../../lib/filters";

interface AdvancedFiltersProps {
  rules: FilterRule[];
  matchMode: "AND" | "OR";
  availableGenres: string[];
  onChangeRules: (rules: FilterRule[]) => void;
  onChangeMatchMode: (m: "AND" | "OR") => void;
}

const selectStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 4px",
  border: "1px solid #3d2815",
  background: "#1a1210",
  color: "#f2e8d2",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  width: 64,
  border: "1px solid #3d2815",
  background: "#1a1210",
  color: "#f2e8d2",
  outline: "none",
};

export default function AdvancedFilters({
  rules,
  matchMode,
  availableGenres,
  onChangeRules,
  onChangeMatchMode,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  function addRule() {
    const field: FieldKey = "year";
    const rule: FilterRule = {
      id: makeRuleId(Date.now() + rules.length),
      field,
      operator: FIELD_DEFS[field].operators[0].key,
      value: "",
    };
    onChangeRules([...rules, rule]);
  }

  function updateRule(id: string, patch: Partial<FilterRule>) {
    onChangeRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRule(id: string) {
    onChangeRules(rules.filter((r) => r.id !== id));
  }

  function changeField(id: string, field: FieldKey) {
    const def = FIELD_DEFS[field];
    updateRule(id, { field, operator: def.operators[0].key, value: "", value2: undefined });
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono cursor-pointer"
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          background: "transparent",
          border: "none",
          color: rules.length > 0 ? "#ff5e00" : "#907558",
          padding: 0,
        }}
      >
        ADVANCED FILTERS {open ? "▴" : "▾"}
        {rules.length > 0 ? ` (${rules.length})` : ""}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {rules.map((rule) => {
            const def = FIELD_DEFS[rule.field];
            const needsV2 = def.needsValue2?.(rule.operator) ?? false;
            return (
              <div key={rule.id} className="flex items-center gap-1 flex-wrap">
                <select
                  value={rule.field}
                  onChange={(e) => changeField(rule.id, e.target.value as FieldKey)}
                  style={selectStyle}
                  className="font-mono cursor-pointer"
                >
                  {(Object.keys(FIELD_DEFS) as FieldKey[]).map((k) => (
                    <option key={k} value={k}>{FIELD_DEFS[k].label}</option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value, value2: undefined })}
                  style={selectStyle}
                  className="font-mono cursor-pointer"
                >
                  {def.operators.map((op) => (
                    <option key={op.key} value={op.key}>{op.label}</option>
                  ))}
                </select>

                {def.valueType === "list" ? (
                  <select
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    style={selectStyle}
                    className="font-mono cursor-pointer"
                  >
                    <option value="">—</option>
                    <option value="favorite">Favorite</option>
                    <option value="recommendation">Recommendation</option>
                  </select>
                ) : def.valueType === "genre" ? (
                  <input
                    list="adv-genres"
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="genre"
                    style={inputStyle}
                    className="font-mono"
                  />
                ) : (
                  <input
                    type={def.valueType === "number" ? "number" : "text"}
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder={def.valueType === "number" ? "0" : "value"}
                    style={inputStyle}
                    className="font-mono"
                  />
                )}

                {needsV2 && (
                  <>
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>–</span>
                    <input
                      type="number"
                      value={rule.value2 ?? ""}
                      onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                      placeholder="0"
                      style={inputStyle}
                      className="font-mono"
                    />
                  </>
                )}

                <button
                  onClick={() => removeRule(rule.id)}
                  className="cursor-pointer"
                  style={{ background: "transparent", border: "none", color: "#907558", fontSize: 12 }}
                  title="Remove rule"
                >
                  ×
                </button>
              </div>
            );
          })}

          <datalist id="adv-genres">
            {availableGenres.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          <div className="flex items-center gap-2">
            <button
              onClick={addRule}
              className="font-mono cursor-pointer"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                letterSpacing: "0.08em",
                border: "1px solid #3d2815",
                background: "transparent",
                color: "#907558",
              }}
            >
              + ADD RULE
            </button>

            {rules.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="font-mono" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
                  MATCH
                </span>
                {(["AND", "OR"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onChangeMatchMode(m)}
                    className="font-mono cursor-pointer"
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      border: matchMode === m ? "1px solid #ff5e00" : "1px solid #3d2815",
                      background: matchMode === m ? "rgba(255,94,0,0.1)" : "transparent",
                      color: matchMode === m ? "#ff5e00" : "#907558",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/library/AdvancedFilters.tsx
git commit -m "feat: advanced filters builder component"
```

---

## Task 6: Wire filters into Lists.tsx + trigger backfill

**Files:**
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `applyFilters`, `getItemGenres` (Task 1); `AdvancedFilters` default export (Task 5); `backfillReleaseDates` (Task 4); existing `useDataCache`, `loadLists`.
- Produces: filtered library view. No new exports.

- [ ] **Step 1: Add imports to `src/pages/Lists.tsx`**

Add:
```ts
import AdvancedFilters from "../components/library/AdvancedFilters";
import { applyFilters, getItemGenres } from "../lib/filters";
import type { FilterRule } from "../lib/filters";
import { backfillReleaseDates } from "../services/api";
```

- [ ] **Step 2: Add filter state (near the other `useState` calls, ~line 44-50)**

```ts
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [matchMode, setMatchMode] = useState<"AND" | "OR">("AND");
```

- [ ] **Step 3: Trigger backfill once on load (after the existing load `useEffect`, ~line 51-57)**

Add a new effect that runs once after lists load, filling missing release dates then refreshing:
```ts
  useEffect(() => {
    if (!listsLoaded) return;
    const hasMissing = [...favorites, ...recommendations].some((i) => {
      const m = (typeof i.metadata === "string" ? null : i.metadata) as Record<string, unknown> | null;
      return !m || !m.release_date;
    });
    if (!hasMissing) return;
    let cancelled = false;
    backfillReleaseDates()
      .then((r) => {
        if (!cancelled && r.updated > 0) loadLists();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listsLoaded]);
```

- [ ] **Step 4: Apply filters in the `useMemo` chain — between `filtered` (search) and `sorted`**

Locate the existing `filtered` memo (search filter, ~line 65-72). Immediately after it, add:
```ts
  const ruleFiltered = useMemo(
    () => applyFilters(filtered, rules, matchMode, pickStats),
    [filtered, rules, matchMode, pickStats]
  );
```
Then change the `sorted` memo to consume `ruleFiltered` instead of `filtered`:
```ts
  const sorted = useMemo(() => {
    return [...ruleFiltered].sort((a, b) => {
```
and update that memo's dependency array from `[filtered, sort, sortDir, pickStats]` to `[ruleFiltered, sort, sortDir, pickStats]`.

- [ ] **Step 5: Compute available genres for the dropdown (after `allItems` memo)**

```ts
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) for (const g of getItemGenres(item)) set.add(g);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);
```

- [ ] **Step 6: Render `AdvancedFilters` below the Sort/Group controls**

Find the closing `</div>` of the "Sort + Group controls" block (the `flex gap-1 items-center flex-wrap` div, closes ~line 290). Immediately after it, still inside the header inner container, add:
```tsx
          <AdvancedFilters
            rules={rules}
            matchMode={matchMode}
            availableGenres={availableGenres}
            onChangeRules={(r) => { setRules(r); setSelectedAlbumId(null); }}
            onChangeMatchMode={setMatchMode}
          />
```

- [ ] **Step 7: Verify typecheck and tests**

Run: `npm run build && npm test`
Expected: build clean, all filter tests pass.

- [ ] **Step 8: Manual verification**

Run `npm run dev`, open the Library tab. Confirm:
1. "ADVANCED FILTERS ▾" appears under the sort controls; expands on click.
2. "+ ADD RULE" adds a Year rule; changing field swaps operators/value input.
3. A Year "is between 1970 and 1989" rule narrows the shelf correctly.
4. Adding a second rule reveals the AND/OR toggle and combines as expected.
5. Removing all rules restores the full library.
6. On first load, release years populate (network tab shows a `POST /api/albums/backfill`); subsequent loads do not re-trigger it.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Lists.tsx
git commit -m "feat: wire advanced filters into library tab"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (A1 single add → Task 3; A2 bulk → Task 3; A3 backfill → Task 4; A4 query helper → Task 2). Part B (`filters.ts` → Task 1; `AdvancedFilters.tsx` → Task 5; Lists wiring → Task 6). All fields (year/genre/artist/list/plays) covered in Task 1 `FIELD_DEFS` + tests.
- **Function cap:** verified in Task 4 Step 3 (11 ≤ 12).
- **Type consistency:** `FilterRule`/`FieldKey`/`PickStat`/`applyFilters`/`getItemGenres`/`getItemYear`/`makeRuleId` defined in Task 1 and consumed unchanged in Tasks 5–6. `fetchAlbumMeta` return shape `{ genres, release_date }` consistent across Tasks 2–4. `updateItemMetadata(userId, itemId, metadata)` signature consistent Tasks 2/4.
- **Out of scope** (per spec): no nested groups, no saved presets, no server-side filtering.

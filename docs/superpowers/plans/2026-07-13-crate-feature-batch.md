# Crate Feature Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship eight independent UX/feature improvements across the Library, Crates, player, and album-search surfaces of the Crate app.

**Architecture:** Client-side React + TypeScript changes for most features, with one small backend change (play endpoint gains an optional track offset). New pure helper `src/lib/coverage.ts` (unit tested), a new read-only `CoveragePanel` component, additions to the `usePlayer` context, and targeted edits to existing pages/components. Reuse existing patterns (`applyFilters`, `DuplicatesPanel` structure, the play-fallback chain in `DetailPanel`).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest (test runner — see below), Spotify Web Playback SDK + Web API, Vercel serverless functions.

## Global Constraints

- **No new serverless functions** — Hobby plan caps at 12; extend existing files only.
- **TypeScript throughout**; no linter configured, but keep types accurate.
- Test runner is **Vitest**. Existing tests live beside sources as `*.test.ts` (e.g. `src/lib/filters.test.ts`, `lib/crates.test.ts`). Run a single file with `npx vitest run <path>`.
- The shared filter engine lives in `lib/filters.ts` and is re-exported by `src/lib/filters.ts`. Client imports from `../lib/filters` or `../../lib/filters`.
- Visual/style language: mono font (`"IBM Plex Mono"`), accent `#ff5e00`, muted `#907558`, border `#3d2815`, bg `#1a1210`/`#140d0a`. Match surrounding inline-style conventions.
- `Item.metadata` may be a JSON string or object — always parse defensively (see `getItemGenres`).
- Commit after each task with a `feat:`/`fix:` message.

---

## File Structure

- **Create** `src/lib/coverage.ts` — pure `findUncovered` helper (Feature 1).
- **Create** `src/lib/coverage.test.ts` — unit tests for coverage.
- **Create** `src/lib/crateFilters.ts` — pure `foldListFilterIntoRules` helper (Feature 5).
- **Create** `src/lib/crateFilters.test.ts` — unit tests for the fold helper.
- **Create** `src/components/library/CoveragePanel.tsx` — read-only gaps panel (Feature 1).
- **Modify** `src/pages/Lists.tsx` — GAPS toggle, filtered count, list-filter fold on save, search-icon header (Features 1, 2, 5, 7).
- **Modify** `src/pages/Crates.tsx` — crate-icon header, remove add-albums button (Feature 7).
- **Modify** `src/components/CrateEditorModal.tsx` — saving state (Feature 3).
- **Modify** `src/components/library/DetailPanel.tsx` — removing spinner, track highlight + click-to-play (Features 4, 6).
- **Modify** `src/hooks/usePlayer.tsx` — position/duration/volume/seek/setVolume, offset in playAlbum (Feature 6).
- **Modify** `src/components/PlayerBar.tsx` — seek bar + volume slider (Feature 6).
- **Modify** `src/pages/AddAlbums.tsx` — play button on search results (Feature 8).
- **Modify** `src/services/api.ts` — `playOnSpotify` optional offset (Feature 6/8).
- **Modify** `src/types/index.ts` — add `uri` to `AlbumTrack` (Feature 6).
- **Modify** `api/spotify/[[...path]].ts` and `lib/spotify.ts` — play endpoint accepts optional offset (Feature 6).
- **Modify** `api/albums/[id].ts` — include track `uri` in track list (Feature 6).

---

## Task 1: `findUncovered` coverage helper

**Files:**
- Create: `src/lib/coverage.ts`
- Test: `src/lib/coverage.test.ts`

**Interfaces:**
- Consumes: `applyFilters(items, rules, matchMode, pickStats)` and types `FilterRule`, `PickStat` from `../../lib/filters`; `Item` from `../types`; `CrateDefinition` from `../types`.
- Produces: `findUncovered(items: Item[], crateDefs: CrateDefinition[], pickStats: Map<number, PickStat>): { albums: Item[]; genres: string[] }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/coverage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/coverage.test.ts`
Expected: FAIL — `findUncovered` is not defined / cannot find module `./coverage`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/coverage.ts`:

```ts
import type { Item, CrateDefinition } from "../types";
import { applyFilters, getItemGenres, type PickStat } from "../../lib/filters";

// A crate contributes to coverage only when its membership is defined by
// filters over the library: weighted, random, or ai_pool from source "library".
// ai_new/hybrid draw non-deterministically (or from outside the library) and
// friends crates have no library pool, so they never count toward coverage.
function hasDeterministicPool(crate: CrateDefinition): boolean {
  if (crate.source !== "library") return false;
  const t = crate.strategy.type;
  return t === "weighted" || t === "random" || t === "ai_pool";
}

export function findUncovered(
  items: Item[],
  crateDefs: CrateDefinition[],
  pickStats: Map<number, PickStat>
): { albums: Item[]; genres: string[] } {
  const coveredIds = new Set<number>();
  for (const crate of crateDefs) {
    if (!hasDeterministicPool(crate)) continue;
    const pool = applyFilters(items, crate.filters.rules, crate.filters.matchMode, pickStats);
    for (const it of pool) coveredIds.add(it.id);
  }

  const albums = items.filter((it) => !coveredIds.has(it.id));

  // A genre is covered if at least one album carrying it is covered.
  const coveredGenres = new Set<string>();
  const allGenres = new Set<string>();
  for (const it of items) {
    const genres = getItemGenres(it);
    const isCovered = coveredIds.has(it.id);
    for (const g of genres) {
      allGenres.add(g);
      if (isCovered) coveredGenres.add(g);
    }
  }
  const genres = Array.from(allGenres)
    .filter((g) => !coveredGenres.has(g))
    .sort((a, b) => a.localeCompare(b));

  return { albums, genres };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/coverage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "feat: add findUncovered coverage helper"
```

---

## Task 2: CoveragePanel component + Library GAPS toggle

**Files:**
- Create: `src/components/library/CoveragePanel.tsx`
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `findUncovered` from `../../lib/coverage`; `Item` from `../../types`.
- Produces: `export default function CoveragePanel({ albums, genres, onClose }: { albums: Item[]; genres: string[]; onClose: () => void })`

- [ ] **Step 1: Create the CoveragePanel component**

Create `src/components/library/CoveragePanel.tsx`:

```tsx
import React from "react";
import type { Item } from "../../types";
import { VinylDisc } from "../VinylDisc";

interface CoveragePanelProps {
  albums: Item[];
  genres: string[];
  onClose: () => void;
}

export default function CoveragePanel({ albums, genres, onClose }: CoveragePanelProps) {
  return (
    <div style={{ padding: "0 12px" }}>
      <div className="max-w-xl lg:max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-display" style={{ fontSize: 15, color: "#f2e8d2", letterSpacing: "0.15em" }}>
            GAPS
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
            not in any crate
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
          <button
            onClick={onClose}
            className="font-mono cursor-pointer"
            style={{ fontSize: 10, padding: "2px 6px", border: "1px solid #3d2815", background: "transparent", color: "#907558" }}
          >
            CLOSE
          </button>
        </div>

        {genres.length > 0 && (
          <div className="mb-4">
            <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 6 }}>
              UNCOVERED GENRES ({genres.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {genres.map((g) => (
                <span key={g} className="font-mono" style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgba(255,94,0,0.35)", color: "#ff5e00" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 6 }}>
          UNCOVERED ALBUMS ({albums.length})
        </div>
        {albums.length === 0 ? (
          <div className="flex items-center gap-3 py-6">
            <VinylDisc size={32} />
            <p className="font-mono italic" style={{ fontSize: 11, color: "#907558", opacity: 0.7 }}>
              every album lives in at least one crate
            </p>
          </div>
        ) : (
          <ul>
            {albums.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 border-b border-crate-border/50 last:border-0">
                <div className="shrink-0" style={{ width: 40, height: 40, background: a.image_url ? undefined : "#0f0a0c" }}>
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title} className="w-full h-full object-cover block" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><VinylDisc size={22} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono truncate" style={{ fontSize: 12, color: "#f2e8d2" }}>{a.title}</p>
                  <p className="font-mono truncate" style={{ fontSize: 10, color: "#907558" }}>{a.creator}</p>
                </div>
                <span className="font-mono shrink-0" style={{ fontSize: 10, color: a.list_type === "favorite" ? "#ff5e00" : "#00b4c8" }}>
                  {a.list_type === "favorite" ? "★" : "◈"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire GAPS toggle into Lists.tsx — imports and state**

In `src/pages/Lists.tsx`, add the import near the other library imports (after the `DuplicatesPanel` import on line 10):

```tsx
import CoveragePanel from "../components/library/CoveragePanel";
import { findUncovered } from "../lib/coverage";
```

Add state next to `showDuplicates` (after line 60):

```tsx
  const [showCoverage, setShowCoverage] = useState(false);
```

- [ ] **Step 3: Compute uncovered set**

In `Lists.tsx`, after the `availableGenres` memo (after line 113), add:

```tsx
  const uncovered = useMemo(
    () => findUncovered(allLibraryItems, crateDefs, pickStats),
    [allLibraryItems, crateDefs, pickStats]
  );
```

- [ ] **Step 4: Add the GAPS button and make the two panels mutually exclusive**

In the controls row, immediately after the DUPLICATES button (the `<button>` ending on line 365 with text `DUPLICATES`), add:

```tsx
            <button
              onClick={() => setShowCoverage((v) => { setSelectedAlbumId(null); setShowDuplicates(false); return !v; })}
              className="font-mono shrink-0 cursor-pointer"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                letterSpacing: "0.08em",
                border: showCoverage ? "1px solid #ff5e00" : "1px solid #3d2815",
                background: showCoverage ? "rgba(255,94,0,0.1)" : "transparent",
                color: showCoverage ? "#ff5e00" : "#907558",
              }}
            >
              GAPS
            </button>
```

Update the existing DUPLICATES button's onClick (line 353) to also close coverage:

```tsx
              onClick={() => setShowDuplicates((v) => { setSelectedAlbumId(null); setShowCoverage(false); return !v; })}
```

- [ ] **Step 5: Render the panel**

In the "Shelf content" block, change the top of the conditional (line 394) from `{showDuplicates ? (` so coverage renders first. Replace:

```tsx
        {showDuplicates ? (
```

with:

```tsx
        {showCoverage ? (
          <CoveragePanel albums={uncovered.albums} genres={uncovered.genres} onClose={() => setShowCoverage(false)} />
        ) : showDuplicates ? (
```

- [ ] **Step 6: Build to verify no type errors**

Run: `npx vite build`
Expected: Build succeeds (no TS errors referencing Lists.tsx or CoveragePanel).

- [ ] **Step 7: Commit**

```bash
git add src/components/library/CoveragePanel.tsx src/pages/Lists.tsx
git commit -m "feat: add GAPS panel showing albums/genres not in any crate"
```

---

## Task 3: Filtered album count in Library

**Files:**
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `ruleFiltered` (existing memo, the fully-filtered list) in `Lists.tsx`.

- [ ] **Step 1: Add the count label**

In `src/pages/Lists.tsx`, in the controls row, right after the `GROUP` `<select>` block's closing (after the divider that follows it — the `<div ... margin: "0 1px" />` on line 351, just before the DUPLICATES button), insert a count label:

```tsx
            <span className="font-mono shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.08em" }}>
              {ruleFiltered.length} {ruleFiltered.length === 1 ? "ALBUM" : "ALBUMS"}
            </span>
            <div className="shrink-0" style={{ width: 1, height: 10, background: "#3d2815", margin: "0 1px" }} />
```

- [ ] **Step 2: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open Library, apply a search/list/advanced filter, and confirm the count updates live and matches the visible albums.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Lists.tsx
git commit -m "feat: show filtered album count in library"
```

---

## Task 4: Fold quick LIST filter into saved crate

**Files:**
- Create: `src/lib/crateFilters.ts`
- Create: `src/lib/crateFilters.test.ts`
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `FilterRule` from `../../lib/filters`.
- Produces: `foldListFilterIntoRules(rules: FilterRule[], matchMode: "AND" | "OR", listFilter: "all" | "favorite" | "recommendation"): { rules: FilterRule[]; matchMode: "AND" | "OR" }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/crateFilters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { foldListFilterIntoRules } from "./crateFilters";
import type { FilterRule } from "../../lib/filters";

describe("foldListFilterIntoRules", () => {
  it("returns rules unchanged when listFilter is 'all'", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "all");
    expect(out.rules).toEqual(rules);
    expect(out.matchMode).toBe("AND");
  });

  it("appends a list rule when listFilter is favorite and no rules exist", () => {
    const out = foldListFilterIntoRules([], "AND", "favorite");
    expect(out.rules).toHaveLength(1);
    expect(out.rules[0]).toMatchObject({ field: "list", operator: "is", value: "favorite" });
    expect(out.matchMode).toBe("AND");
  });

  it("appends a list rule alongside existing AND rules", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "recommendation");
    expect(out.rules).toHaveLength(2);
    expect(out.rules[1]).toMatchObject({ field: "list", operator: "is", value: "recommendation" });
  });

  it("does not duplicate an existing identical list rule", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "list", operator: "is", value: "favorite" }];
    const out = foldListFilterIntoRules(rules, "AND", "favorite");
    expect(out.rules).toHaveLength(1);
  });

  it("generates a unique rule id", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "favorite");
    const ids = out.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/crateFilters.test.ts`
Expected: FAIL — cannot find module `./crateFilters`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/crateFilters.ts`:

```ts
import type { FilterRule } from "../../lib/filters";

// Fold the Library's quick LIST filter (favorite/recommendation) into a crate's
// rule list so a crate saved from the Library reproduces what the user sees.
//
// NOTE: When existing rules use matchMode "OR", appending an AND-style list
// constraint to a flat OR rule set is not perfectly expressible — the list rule
// becomes just another OR term. The dominant case (list filter with no rules, or
// with AND rules) is exact; the OR + list combination is a documented limitation.
export function foldListFilterIntoRules(
  rules: FilterRule[],
  matchMode: "AND" | "OR",
  listFilter: "all" | "favorite" | "recommendation"
): { rules: FilterRule[]; matchMode: "AND" | "OR" } {
  if (listFilter === "all") return { rules, matchMode };

  const alreadyPresent = rules.some(
    (r) => r.field === "list" && r.operator === "is" && r.value === listFilter
  );
  if (alreadyPresent) return { rules, matchMode };

  const listRule: FilterRule = {
    id: `rule-list-${Date.now()}`,
    field: "list",
    operator: "is",
    value: listFilter,
  };
  return { rules: [...rules, listRule], matchMode };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/crateFilters.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Use the helper in Lists.tsx**

In `src/pages/Lists.tsx`, add the import after the coverage import from Task 2:

```tsx
import { foldListFilterIntoRules } from "../lib/crateFilters";
```

Change the "SAVE AS CRATE" button onClick (line 367). Replace:

```tsx
              onClick={() => setEditing({ ...makeEmptyCrate(crateDefs.length), filters: { rules, matchMode } })}
```

with:

```tsx
              onClick={() => setEditing({ ...makeEmptyCrate(crateDefs.length), filters: foldListFilterIntoRules(rules, matchMode, listFilter) })}
```

- [ ] **Step 6: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crateFilters.ts src/lib/crateFilters.test.ts src/pages/Lists.tsx
git commit -m "fix: carry quick LIST filter into crate on save-as-crate"
```

---

## Task 5: Saving indicator in CrateEditorModal

**Files:**
- Modify: `src/components/CrateEditorModal.tsx`

**Interfaces:**
- Consumes: `onSave` prop (now may return a promise).
- Produces: `onSave` prop type widened to `(crate: CrateDefinition) => void | Promise<void>`.

- [ ] **Step 1: Widen the onSave prop type**

In `src/components/CrateEditorModal.tsx`, change the interface (line 108):

```tsx
  onSave: (crate: CrateDefinition) => void | Promise<void>;
```

- [ ] **Step 2: Add saving state**

After the `confirmDelete` state (line 127) add:

```tsx
  const [saving, setSaving] = useState(false);
```

- [ ] **Step 3: Make handleSave await and track saving**

Replace `handleSave` (lines 150–158):

```tsx
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        ...initial,
        name: name.trim() || "Untitled Crate",
        count,
        filters: { rules, matchMode },
        strategy: buildStrategy(),
      });
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 4: Reflect saving in the SAVE button**

Replace the SAVE button (lines 319–322):

```tsx
            <button onClick={handleSave} disabled={saving} className="font-mono cursor-pointer disabled:opacity-60"
              style={{ fontSize: 10, padding: "6px 12px", color: "#ff5e00", border: "1px solid rgba(255,94,0,0.6)", background: "rgba(255,94,0,0.12)", borderRadius: 4, letterSpacing: "0.1em" }}>
              {saving ? "SAVING…" : "SAVE"}
            </button>
```

Note: `onClose` fires on backdrop click; `saving` guarding re-entry in `handleSave` is enough. The parent closes the modal after its save resolves, so no extra guard is needed here.

- [ ] **Step 5: Build to verify**

Run: `npx vite build`
Expected: Build succeeds. (Callers in `Crates.tsx` and `Lists.tsx` already pass async handlers; the widened type accepts them.)

- [ ] **Step 6: Commit**

```bash
git add src/components/CrateEditorModal.tsx
git commit -m "feat: show saving indicator while saving a crate"
```

---

## Task 6: Removing indicator in DetailPanel

**Files:**
- Modify: `src/components/library/DetailPanel.tsx`

**Interfaces:**
- Consumes/produces: internal state only.

- [ ] **Step 1: Add removing state**

In `src/components/library/DetailPanel.tsx`, after the `removeConfirm` state (line 61) add:

```tsx
  const [removing, setRemoving] = useState(false);
```

- [ ] **Step 2: Set removing during delete**

Replace the confirm branch of `handleRemoveClick` (lines 204–212, the `else { ... }` block) with:

```tsx
    } else {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
      setRemoving(true);
      try {
        await deleteAlbum(item.id);
        onRemove(item);
      } catch {
        setRemoving(false);
        setRemoveConfirm(false);
      }
    }
```

- [ ] **Step 3: Reflect removing in the REMOVE button**

Replace the REMOVE button block (lines 432–446). The new version disables during removal and shows a status label:

```tsx
            {!promoted && !readOnly && (
              <button
                onClick={handleRemoveClick}
                disabled={removing}
                className="font-mono cursor-pointer disabled:opacity-60"
                style={{
                  fontSize: 10,
                  padding: "6px 10px",
                  border: removeConfirm ? "1px solid rgba(255,85,85,0.5)" : "1px solid rgba(180,0,0,0.35)",
                  color: "#ff5555",
                  background: removeConfirm ? "rgba(180,0,0,0.15)" : "transparent",
                }}
              >
                {removing ? "…" : isFriendRec ? "DISMISS" : removeConfirm ? "REMOVE?" : "REMOVE"}
              </button>
            )}
```

- [ ] **Step 4: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/library/DetailPanel.tsx
git commit -m "feat: show removing indicator when deleting an album"
```

---

## Task 7: Header icons — search on Library, crate on Crates

**Files:**
- Modify: `src/pages/Lists.tsx`
- Modify: `src/pages/Crates.tsx`

**Interfaces:**
- None (JSX only).

- [ ] **Step 1: Library — swap the `+` add button for a search icon**

In `src/pages/Lists.tsx`, replace the add-albums button (lines 216–234, the `<button onClick={() => navigate("/add")} ...>+</button>`) with a search-icon button:

```tsx
              <button
                onClick={() => navigate("/add")}
                className="flex items-center justify-center cursor-pointer"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#ff5e00",
                  border: "none",
                  color: "#fff",
                  boxShadow: "0 2px 10px rgba(255,94,0,0.4)",
                }}
                title="Search for new albums"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
```

- [ ] **Step 2: Crates — remove the add-albums button and re-icon the new-crate button**

In `src/pages/Crates.tsx`, delete the add-albums button entirely (lines 214–230, the `<button onClick={() => navigate("/add")} ...>` with the plus-path SVG).

Then replace the contents of the new-crate button (lines 195–213) so its icon is a crate/box instead of `+`. Replace the `>` `+` `</button>` inner text — change the button to:

```tsx
            <button
              onClick={() => setEditingCrate(makeEmptyCrate(crateDefs.length))}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#ff5e00",
                border: "none",
                color: "#fff",
                boxShadow: "0 2px 10px rgba(255,94,0,0.4)",
              }}
              title="New crate"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18l-1.5 12.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L3 7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l2-3h14l2 3M9 11v5M15 11v5" />
              </svg>
            </button>
```

- [ ] **Step 3: Remove now-unused `useNavigate` import in Crates if unreferenced**

After removing the add-albums button, check whether `navigate` is still used in `Crates.tsx`. Run:

```bash
grep -n "navigate" src/pages/Crates.tsx
```

If the only remaining references are the import (line 2) and the `const navigate = useNavigate();` (line 48), remove both lines. If `navigate` is used elsewhere, leave them.

- [ ] **Step 4: Build to verify**

Run: `npx vite build`
Expected: Build succeeds with no "unused variable" errors (note: no linter, but an unused `navigate` const is harmless — still prefer removing it for cleanliness).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Lists.tsx src/pages/Crates.tsx
git commit -m "feat: search icon on Library header, crate icon on Crates header"
```

---

## Task 8: Backend — play endpoint accepts optional track offset

**Files:**
- Modify: `lib/spotify.ts:339-358`
- Modify: `api/spotify/[[...path]].ts:18-30`
- Modify: `src/services/api.ts:163-168`

**Interfaces:**
- Produces:
  - `startPlayback(userId: number, spotifyUri: string, deviceId?: string, positionOffset?: number): Promise<void>`
  - `playOnSpotify(spotifyUri: string, deviceId?: string, positionOffset?: number): Promise<void>`
  - `PUT /api/spotify/play` body: `{ spotify_uri: string; device_id?: string; offset?: number }`

- [ ] **Step 1: Extend startPlayback**

In `lib/spotify.ts`, replace `startPlayback` (lines 339–358):

```ts
export async function startPlayback(
  userId: number,
  spotifyUri: string,
  deviceId?: string,
  positionOffset?: number
): Promise<void> {
  const payload: Record<string, unknown> = { context_uri: spotifyUri };
  if (typeof positionOffset === "number" && positionOffset >= 0) {
    payload.offset = { position: positionOffset };
  }
  const body = JSON.stringify(payload);
  const endpoint = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/play";
  const res = await spotifyFetch(userId, endpoint, {
    method: "PUT",
    body,
  });
  if (res.status === 404) {
    throw new Error("No active Spotify device found. Open Spotify on any device first.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to start playback: ${res.status}`);
  }
}
```

- [ ] **Step 2: Pass offset through the API route**

In `api/spotify/[[...path]].ts`, replace the play block (lines 19–30):

```ts
  if (route === "play" && req.method === "PUT") {
    const { spotify_uri, device_id, offset } = req.body as { spotify_uri?: string; device_id?: string; offset?: number };
    if (!spotify_uri) return res.status(400).json({ error: "spotify_uri is required" });
    try {
      await startPlayback(user.id, spotify_uri, device_id, typeof offset === "number" ? offset : undefined);
      return res.status(204).end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("No active Spotify device") ? 404 : 502;
      return res.status(status).json({ error: message });
    }
  }
```

- [ ] **Step 3: Extend the client playOnSpotify**

In `src/services/api.ts`, replace `playOnSpotify` (lines 163–168):

```ts
export async function playOnSpotify(spotifyUri: string, deviceId?: string, positionOffset?: number): Promise<void> {
  await request("/spotify/play", {
    method: "PUT",
    body: JSON.stringify({
      spotify_uri: spotifyUri,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(typeof positionOffset === "number" ? { offset: positionOffset } : {}),
    }),
  });
}
```

- [ ] **Step 4: Build to verify**

Run: `npx vite build`
Expected: Build succeeds. (The API/lib files are not part of the vite client build, but the shared `playOnSpotify` signature must still typecheck; the build covers client imports.)

- [ ] **Step 5: Commit**

```bash
git add lib/spotify.ts "api/spotify/[[...path]].ts" src/services/api.ts
git commit -m "feat: play endpoint accepts optional track offset"
```

---

## Task 9: Track uri in album details

**Files:**
- Modify: `src/types/index.ts:63-69`
- Modify: `api/albums/[id].ts:95-101`

**Interfaces:**
- Produces: `AlbumTrack` gains `uri: string`. The `/api/albums/:id` track list objects gain `uri`.

- [ ] **Step 1: Add uri to AlbumTrack type**

In `src/types/index.ts`, replace the `AlbumTrack` interface (lines 63–69):

```ts
export interface AlbumTrack {
  number: number;
  disc: number;
  name: string;
  duration_ms: number;
  artists: string;
  uri: string;
}
```

- [ ] **Step 2: Include uri in the API track list**

In `api/albums/[id].ts`, replace the `trackList` map (lines 95–101):

```ts
        const trackList = tracks.map((t) => ({
          number: t.track_number,
          disc: t.disc_number,
          name: t.name,
          duration_ms: t.duration_ms,
          artists: t.artists.map((a) => a.name).join(", "),
          uri: t.uri,
        }));
```

- [ ] **Step 3: Confirm the Spotify track type exposes `uri`**

Run:

```bash
grep -n "uri" lib/spotify.ts | grep -i "track\|SimplifiedTrack\|interface"
```

If `getAlbumTracks`'s return type does not include `uri`, open `lib/spotify.ts`, find the track type used by `getAlbumTracks`, and add `uri: string;` to it. Spotify's track objects always include `uri`, so this is a type-only addition.

- [ ] **Step 4: Build to verify**

Run: `npx vite build`
Expected: Build succeeds (AlbumTrack consumers in DetailPanel still compile — `uri` is additive).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts "api/albums/[id].ts" lib/spotify.ts
git commit -m "feat: include track uri in album details"
```

---

## Task 10: Player hook — position, duration, volume, seek

**Files:**
- Modify: `src/types/spotify-sdk.d.ts`
- Modify: `src/hooks/usePlayer.tsx`

**Interfaces:**
- Consumes: `playOnSpotify(uri, deviceId?, offset?)` from Task 8.
- Produces (added to `PlayerContextValue`):
  - `position: number` (ms), `duration: number` (ms), `volume: number` (0–1)
  - `seek(positionMs: number): Promise<void>`
  - `setVolume(v: number): Promise<void>`
  - `playAlbum(uri: string, offset?: number): Promise<void>` (offset added)

- [ ] **Step 1: Declare seek/setVolume and position/duration on the SDK types**

The local SDK typings (`src/types/spotify-sdk.d.ts`) do not declare `seek`/`setVolume`, nor `position`/`duration` on `PlaybackState`, so the code in later steps would fail to typecheck.

First, add `position` and `duration` to the `PlaybackState` interface (lines 28–31). Replace it with:

```ts
    interface PlaybackState {
      paused: boolean;
      position: number;
      duration: number;
      track_window: { current_track: Track };
    }
```

Then add three methods to the `Player` class (after `previousTrack(): Promise<void>;` on line 53):

```ts
      seek(positionMs: number): Promise<void>;
      setVolume(volume: number): Promise<void>;
      getVolume(): Promise<number>;
```

- [ ] **Step 2: Extend the context type and default value**

In `src/hooks/usePlayer.tsx`, update the `PlayerContextValue` interface (lines 6–19) to add the new fields:

```tsx
interface PlayerContextValue {
  available: boolean;
  canPlay: boolean;
  deviceId: string | null;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  playAlbum(uri: string, offset?: number): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(v: number): Promise<void>;
}
```

Update the default context object (lines 22–32):

```tsx
const PlayerContext = createContext<PlayerContextValue>({
  available: false,
  canPlay: false,
  deviceId: null,
  currentTrack: null,
  paused: true,
  position: 0,
  duration: 0,
  volume: 1,
  playAlbum: noop,
  togglePlay: noop,
  next: noop,
  previous: noop,
  seek: noop,
  setVolume: noop,
});
```

- [ ] **Step 3: Add state**

After the `paused` state (line 43) add:

```tsx
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
```

- [ ] **Step 4: Capture position/duration from player_state_changed**

In the `player_state_changed` listener (lines 73–83), after `setPaused(state.paused);` add:

```tsx
        setPosition(state.position);
        setDuration(state.duration);
```

- [ ] **Step 5: Advance position with an interval while playing**

Add this effect after the main SDK `useEffect` (after line 124, before `waitForDevice`):

```tsx
  // While playing, advance the position locally between SDK state events so the
  // seek bar moves smoothly. Re-synced on every player_state_changed.
  useEffect(() => {
    if (paused) return;
    const started = performance.now();
    const base = position;
    const timer = setInterval(() => {
      setPosition(Math.min(base + (performance.now() - started), duration || Infinity));
    }, 500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, duration, currentTrack?.uri]);
```

Note: depends on `currentTrack?.uri` (not `position`) so it resets on track change, not on every tick. `performance.now()` is a browser API and is available at runtime.

- [ ] **Step 6: Add seek and setVolume callbacks**

After the `previous` callback (line 149) add:

```tsx
  const seek = useCallback(async (positionMs: number) => {
    await playerRef.current?.seek(positionMs);
    setPosition(positionMs);
  }, []);

  const setVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    await playerRef.current?.setVolume(clamped);
    setVolumeState(clamped);
  }, []);
```

- [ ] **Step 7: Thread offset through playAlbum**

Replace `playAlbum` (lines 142–145):

```tsx
  const playAlbum = useCallback(async (uri: string, offset?: number) => {
    const id = await waitForDevice();
    await playOnSpotify(uri, id, offset);
  }, [waitForDevice]);
```

- [ ] **Step 8: Expose new values in the provider**

Replace the provider value (line 152):

```tsx
    <PlayerContext.Provider value={{ available, canPlay, deviceId, currentTrack, paused, position, duration, volume, playAlbum, togglePlay, next, previous, seek, setVolume }}>
```

- [ ] **Step 9: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/usePlayer.tsx src/types/spotify-sdk.d.ts
git commit -m "feat: expose position/duration/volume/seek/setVolume from player"
```

---

## Task 11: PlayerBar — seek bar and volume slider

**Files:**
- Modify: `src/components/PlayerBar.tsx`

**Interfaces:**
- Consumes: `position`, `duration`, `volume`, `seek`, `setVolume` from `usePlayer` (Task 10).

- [ ] **Step 1: Rewrite PlayerBar with seek + volume**

Replace the entire body of `src/components/PlayerBar.tsx`:

```tsx
import React from "react";
import { usePlayer } from "../hooks/usePlayer";

function fmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const { available, currentTrack, paused, togglePlay, next, previous, position, duration, volume, seek, setVolume } = usePlayer();

  if (!available || !currentTrack) return null;

  const btn = "flex items-center justify-center w-9 h-9 text-crate-text/80 hover:text-crate-text transition-colors cursor-pointer";

  return (
    <div
      className="fixed bottom-[70px] left-0 right-0 z-50 flex flex-col gap-1 px-4 py-2 border-t"
      style={{ background: "#1a120b", borderColor: "#3d2815" }}
    >
      <div className="flex items-center gap-3">
        {currentTrack.image_url && (
          <img src={currentTrack.image_url} alt="" className="w-11 h-11 object-cover" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12px] text-crate-text">{currentTrack.name}</p>
          <p className="truncate font-mono text-[10px] text-crate-muted">{currentTrack.artist}</p>
        </div>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-1.5 w-24">
          <svg className="w-3.5 h-3.5 text-crate-muted shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => { void setVolume(Number(e.target.value)); }}
            className="w-full accent-crate-accent cursor-pointer"
            aria-label="Volume"
          />
        </div>

        {/* Transport */}
        <div className="flex items-center gap-1">
          <button aria-label="Previous" className={btn} onClick={() => { void previous(); }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </button>
          <button aria-label={paused ? "Play" : "Pause"} className={btn} onClick={() => { void togglePlay(); }}>
            {paused ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
            )}
          </button>
          <button aria-label="Next" className={btn} onClick={() => { void next(); }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" /></svg>
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] text-crate-muted shrink-0 w-8 text-right">{fmt(position)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1000}
          value={Math.min(position, duration || 0)}
          onChange={(e) => { void seek(Number(e.target.value)); }}
          className="flex-1 accent-crate-accent cursor-pointer"
          aria-label="Seek"
        />
        <span className="font-mono text-[9px] text-crate-muted shrink-0 w-8">{fmt(duration)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Manual check**

Run `npm run dev` on desktop with a Spotify Premium account, play an album, and confirm: seek bar advances, dragging it seeks, and the volume slider changes volume.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlayerBar.tsx
git commit -m "feat: add seek bar and volume control to player bar"
```

---

## Task 12: DetailPanel — highlight and click-to-play tracks

**Files:**
- Modify: `src/components/library/DetailPanel.tsx`

**Interfaces:**
- Consumes: `usePlayer().currentTrack`, `playAlbum(uri, offset?)`, `player.canPlay`; `AlbumTrack.uri` (Task 9); `playOnSpotify(uri, deviceId?, offset?)` (Task 8).

- [ ] **Step 1: Compute album uri and a track-play handler**

In `src/components/library/DetailPanel.tsx`, inside the component (after `const multiDisc = ...` on line 245), add:

```tsx
  const albumUri = item.external_uri || (item.external_id ? `spotify:album:${item.external_id}` : null);

  const playingUri = player.currentTrack?.uri ?? null;

  const handlePlayTrack = async (trackIndex: number) => {
    if (!albumUri) return;
    onPlay?.();
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      const url = item.external_url || albumUri;
      if (url) window.location.href = url;
      return;
    }
    if (player.canPlay) {
      try { await player.playAlbum(albumUri, trackIndex); return; } catch { /* fall through */ }
    }
    try { await playOnSpotify(albumUri, undefined, trackIndex); return; } catch { /* fall through */ }
    if (item.external_url) window.open(item.external_url, "_blank");
  };
```

Note: `playOnSpotify` is already imported at the top of the file (line 3).

- [ ] **Step 2: Make track rows highlight + clickable**

Replace the track row `<div>` (lines 601–611, the `<div className="flex items-baseline gap-2 py-0.5">` block) with a clickable, highlight-aware version:

```tsx
                    <div
                      className="flex items-baseline gap-2 py-0.5 cursor-pointer"
                      onClick={() => handlePlayTrack(i)}
                      style={{
                        background: playingUri && track.uri === playingUri ? "rgba(29,185,84,0.12)" : undefined,
                      }}
                      title="Play this track"
                    >
                      <span className="font-mono shrink-0 text-right" style={{ fontSize: 10, color: playingUri && track.uri === playingUri ? "#1DB954" : "rgba(144,117,88,0.5)", width: 18 }}>
                        {playingUri && track.uri === playingUri ? "▶" : track.number}
                      </span>
                      <span className="font-mono truncate flex-1" style={{ fontSize: 10, color: playingUri && track.uri === playingUri ? "#1DB954" : "#f2e8d2" }}>
                        {track.name}
                      </span>
                      <span className="font-mono shrink-0" style={{ fontSize: 10, color: "rgba(144,117,88,0.4)" }}>
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
```

- [ ] **Step 3: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Manual check**

Run `npm run dev` on desktop with Premium, open an album's details, click a track — it should start the album at that track, and the row for the currently-playing track should highlight green.

- [ ] **Step 5: Commit**

```bash
git add src/components/library/DetailPanel.tsx
git commit -m "feat: highlight and click-to-play tracks in album details"
```

---

## Task 13: Playable album from search results

**Files:**
- Modify: `src/pages/AddAlbums.tsx`

**Interfaces:**
- Consumes: `usePlayer` (`canPlay`, `playAlbum`); `playOnSpotify` from `../services/api`.

- [ ] **Step 1: Add imports and player hook to SearchTab**

In `src/pages/AddAlbums.tsx`, update the api import (lines 5–8) to include `playOnSpotify`:

```tsx
import {
  searchSpotify, addAlbum, getSpotifyLibrary, getSpotifyPlaylists,
  getPlaylistAlbums, bulkAddAlbums, playOnSpotify,
} from "../services/api";
```

Add the player import near the top (after line 4):

```tsx
import { usePlayer } from "../hooks/usePlayer";
```

Inside `SearchTab` (after the `timer` ref on line 34), add:

```tsx
  const player = usePlayer();

  const handlePlay = async (album: SpotifySearchResult) => {
    const uri = album.spotify_uri || (album.spotify_id ? `spotify:album:${album.spotify_id}` : null);
    const url = album.spotify_url || uri;
    if (!uri && !url) return;
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      if (url) window.location.href = url;
      return;
    }
    if (uri && player.canPlay) {
      try { await player.playAlbum(uri); return; } catch { /* fall through */ }
    }
    if (uri) {
      try { await playOnSpotify(uri); return; } catch { /* fall through */ }
    }
    if (url) window.open(url, "_blank");
  };
```

- [ ] **Step 2: Add a play button to each result row**

In the result row's action group, add a play button before the FAV/REC block. Replace the opening of the actions `<div className="flex gap-1.5 shrink-0">` (line 94) and insert the play button as its first child:

```tsx
                <div className="flex gap-1.5 shrink-0 items-center">
                  <button
                    onClick={() => handlePlay(album)}
                    title="Play on Spotify"
                    className="flex items-center justify-center cursor-pointer"
                    style={{ width: 28, height: 28, border: "1px solid rgba(29,185,84,0.4)", color: "#1DB954", background: "rgba(29,185,84,0.08)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </button>
```

(Leave the existing `addedAs ? ... : ...` FAV/REC block as-is, immediately following. Make sure the surrounding `</div>` still closes this actions group.)

- [ ] **Step 3: Confirm SpotifySearchResult has spotify_uri/spotify_url**

Run:

```bash
grep -n "SpotifySearchResult" src/types/index.ts
```

Open the type and confirm it includes `spotify_uri` and `spotify_url` (it is used in `handleAdd` already with `spotify_uri`/`spotify_url`, so they exist). No change needed if present.

- [ ] **Step 4: Build to verify**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Manual check**

Run `npm run dev`, go to Add Albums → Search, search an album, click the play button — it should start playback (in-app on desktop Premium, or open Spotify otherwise).

- [ ] **Step 6: Commit**

```bash
git add src/pages/AddAlbums.tsx
git commit -m "feat: play album directly from search results"
```

---

## Task 14: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: All tests pass (including new `coverage.test.ts` and `crateFilters.test.ts`).

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and verify each feature end-to-end:
1. Library → GAPS button shows uncovered albums/genres.
2. Library shows a live filtered album count.
3. Saving a crate shows "SAVING…".
4. Removing an album from recs shows a spinner.
5. Save-as-crate while on "◈ REC" produces a crate scoped to recommendations.
6. Player has a working seek bar + volume; album details highlight the playing track and click-to-play works.
7. Library header has a search icon (→ /add); Crates header has a crate icon (new crate) and no add-albums button.
8. Search results have a working play button.

- [ ] **Step 4: No commit needed** (verification task).
```

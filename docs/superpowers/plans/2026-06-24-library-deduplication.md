# Library De-duplication Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Find duplicates" tool to the Library (Lists) page that scans the in-memory library for duplicate albums and lets the user manually review and batch-delete extra copies.

**Architecture:** A new pure detection module (`src/lib/duplicates.ts`) groups items by exact Spotify ID and by fuzzy normalized title+artist. A new inline panel component (`src/components/library/DuplicatesPanel.tsx`) renders the groups for manual review and stages deletes, committing them all at once via the existing `deleteAlbum` client helper. `Lists.tsx` gains a toggle button and renders the panel in place of the shelf when active. All scanning is client-side against `DataCache`; no server changes.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, Vitest. Tests run with `npm test` (vitest run).

## Global Constraints

- No new serverless function — deletion reuses the existing `DELETE /api/albums/[id]` via the `deleteAlbum(id)` client helper (Hobby plan 12-function limit).
- All detection is client-side and pure; follow the style of `src/lib/filters.ts`.
- `Item` shape (from `src/types`): `{ id: number; user_id: number; media_type: string; list_type: "favorite" | "recommendation"; title: string; creator: string; image_url: string | null; external_id: string; external_uri: string | null; external_url: string | null; added_at: number; metadata: Record<string, unknown> | string | null }`.
- Detection returns only groups with 2+ items. Items grouped as exact are never re-flagged as fuzzy.
- Nothing is deleted server-side until the user confirms the batch delete.

---

### Task 1: Detection module — normalization + grouping with tests

**Files:**
- Create: `src/lib/duplicates.ts`
- Test: `src/lib/duplicates.test.ts`

**Interfaces:**
- Consumes: `Item` from `../types`.
- Produces:
  - `normalizeArtist(s: string): string`
  - `normalizeTitle(s: string): string`
  - `interface DuplicateGroup { matchType: "exact" | "fuzzy"; items: Item[] }`
  - `findDuplicateGroups(items: Item[]): DuplicateGroup[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/duplicates.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/duplicates.test.ts`
Expected: FAIL — cannot resolve `./duplicates` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/duplicates.ts`:

```ts
import type { Item } from "../types";

export interface DuplicateGroup {
  matchType: "exact" | "fuzzy";
  items: Item[];
}

// Edition / remaster suffixes that should be ignored when comparing titles.
const PAREN_SUFFIX = /\s*[([](?:[^)\]]*\b(?:deluxe|remaster(?:ed)?|expanded|anniversary|bonus track|special|legacy|edition)\b[^)\]]*)[)\]]\s*/gi;
const DASH_SUFFIX = /\s*-\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*$/gi;

function baseNormalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArtist(s: string): string {
  return baseNormalize(s);
}

export function normalizeTitle(s: string): string {
  const stripped = s.replace(PAREN_SUFFIX, " ").replace(DASH_SUFFIX, " ");
  return baseNormalize(stripped);
}

export function findDuplicateGroups(items: Item[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const consumed = new Set<number>(); // item ids already placed in an exact group

  // Exact: group by external_id
  const byExternalId = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.external_id;
    const arr = byExternalId.get(key);
    if (arr) arr.push(it);
    else byExternalId.set(key, [it]);
  }
  for (const arr of byExternalId.values()) {
    if (arr.length >= 2) {
      groups.push({ matchType: "exact", items: arr });
      for (const it of arr) consumed.add(it.id);
    }
  }

  // Fuzzy: group remaining items by normalized title + artist
  const byFuzzy = new Map<string, Item[]>();
  for (const it of items) {
    if (consumed.has(it.id)) continue;
    const key = `${normalizeTitle(it.title)}::${normalizeArtist(it.creator)}`;
    const arr = byFuzzy.get(key);
    if (arr) arr.push(it);
    else byFuzzy.set(key, [it]);
  }
  for (const arr of byFuzzy.values()) {
    // Only a real fuzzy duplicate if the external_ids differ.
    const distinctIds = new Set(arr.map((i) => i.external_id));
    if (arr.length >= 2 && distinctIds.size >= 2) {
      groups.push({ matchType: "fuzzy", items: arr });
    }
  }

  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/duplicates.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/duplicates.ts src/lib/duplicates.test.ts
git commit -m "feat: duplicate detection module (exact + fuzzy)"
```

---

### Task 2: DuplicatesPanel component — review UI + batch delete

**Files:**
- Create: `src/components/library/DuplicatesPanel.tsx`

**Interfaces:**
- Consumes:
  - `findDuplicateGroups`, `DuplicateGroup` from `../../lib/duplicates`.
  - `deleteAlbum(id: number): Promise<void>` from `../../services/api`.
  - `Item` from `../../types`.
  - `pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>` (same shape exposed by `DataCache`).
- Produces:
  - `interface DuplicatesPanelProps { items: Item[]; pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>; onDeleted: (ids: number[]) => void; onClose: () => void; }`
  - `export default function DuplicatesPanel(props: DuplicatesPanelProps)`

- [ ] **Step 1: Create the component**

Create `src/components/library/DuplicatesPanel.tsx`:

```tsx
import React, { useMemo, useState } from "react";
import type { Item } from "../../types";
import { findDuplicateGroups } from "../../lib/duplicates";
import { deleteAlbum } from "../../services/api";

interface DuplicatesPanelProps {
  items: Item[];
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  onDeleted: (ids: number[]) => void;
  onClose: () => void;
}

function itemYear(item: Item): string {
  const m = typeof item.metadata === "string" ? safeParse(item.metadata) : item.metadata;
  const rd = m && (m as Record<string, unknown>).release_date;
  if (typeof rd === "string" && rd.length >= 4) return rd.slice(0, 4);
  return "—";
}

function safeParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}

export default function DuplicatesPanel({ items, pickStats, onDeleted, onClose }: DuplicatesPanelProps) {
  const groups = useMemo(() => findDuplicateGroups(items), [items]);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [errorIds, setErrorIds] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (marked.size === 0) return;
    if (!window.confirm(`Delete ${marked.size} album${marked.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    setDeleting(true);
    const ids = Array.from(marked);
    const results = await Promise.allSettled(ids.map((id) => deleteAlbum(id)));
    const ok: number[] = [];
    const failed = new Set<number>();
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(ids[i]);
      else failed.add(ids[i]);
    });
    setDeleting(false);
    setErrorIds(failed);
    setMarked(new Set(failed));
    if (ok.length > 0) onDeleted(ok);
  }

  return (
    <div style={{ padding: "0 12px", maxWidth: 896, margin: "0 auto" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="font-mono" style={{ fontSize: 11, color: "#907558", letterSpacing: "0.12em" }}>
          {groups.length === 0 ? "NO DUPLICATES FOUND" : `${groups.length} DUPLICATE GROUP${groups.length === 1 ? "" : "S"}`}
        </span>
        <button
          onClick={onClose}
          className="font-mono cursor-pointer"
          style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #3d2815", background: "transparent", color: "#907558" }}
        >
          DONE
        </button>
      </div>

      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 16, border: `1px solid ${g.matchType === "fuzzy" ? "#a86a1f" : "#3d2815"}`, padding: 10 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 8, color: g.matchType === "fuzzy" ? "#d99a3a" : "#907558" }}>
            {g.matchType === "fuzzy" ? "◇ POSSIBLE DUPLICATE" : "◆ EXACT DUPLICATE"}
          </div>
          {g.items.map((it) => {
            const isMarked = marked.has(it.id);
            const failed = errorIds.has(it.id);
            return (
              <div key={it.id} className="flex items-center gap-2" style={{ padding: "4px 0" }}>
                {it.image_url
                  ? <img src={it.image_url} alt="" style={{ width: 36, height: 36, objectFit: "cover" }} />
                  : <div style={{ width: 36, height: 36, background: "#1a1210" }} />}
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="font-mono truncate" style={{ fontSize: 11, color: "#f2e8d2" }}>{it.title}</div>
                  <div className="font-mono truncate" style={{ fontSize: 10, color: "#907558" }}>
                    {it.creator} · {itemYear(it)} · {it.list_type === "favorite" ? "★ FAV" : "◈ REC"} · {pickStats.get(it.id)?.pickCount ?? 0} plays
                  </div>
                  {failed && <div className="font-mono" style={{ fontSize: 9, color: "#e0573e" }}>delete failed — try again</div>}
                </div>
                <button
                  onClick={() => toggle(it.id)}
                  disabled={deleting}
                  className="font-mono cursor-pointer shrink-0"
                  style={{
                    fontSize: 10, padding: "2px 8px",
                    border: isMarked ? "1px solid #e0573e" : "1px solid #3d2815",
                    background: isMarked ? "rgba(224,87,62,0.12)" : "transparent",
                    color: isMarked ? "#e0573e" : "#907558",
                  }}
                >
                  {isMarked ? "✕ DELETE" : "DELETE"}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {groups.length > 0 && (
        <div className="sticky" style={{ bottom: 0, padding: "10px 0", background: "rgba(15,10,12,0.97)" }}>
          <button
            onClick={handleDelete}
            disabled={marked.size === 0 || deleting}
            className="font-mono cursor-pointer w-full"
            style={{
              fontSize: 11, padding: "8px", letterSpacing: "0.1em",
              border: "1px solid #e0573e",
              background: marked.size === 0 ? "transparent" : "rgba(224,87,62,0.15)",
              color: marked.size === 0 ? "#6b5640" : "#e0573e",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "DELETING…" : `DELETE ${marked.size} ITEM${marked.size === 1 ? "" : "S"}`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks / builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/library/DuplicatesPanel.tsx
git commit -m "feat: duplicates review panel with batch delete"
```

---

### Task 3: Wire panel into Lists page

**Files:**
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `DuplicatesPanel` (default export) from `../components/library/DuplicatesPanel`.
- Uses existing `Lists` state: `favorites`, `recommendations`, `setFavorites`, `setRecommendations`, `pickStats`, `allItems` (from `useDataCache`).

- [ ] **Step 1: Add the import**

In `src/pages/Lists.tsx`, after the existing `AdvancedFilters` import (line 9), add:

```tsx
import DuplicatesPanel from "../components/library/DuplicatesPanel";
```

- [ ] **Step 2: Add panel toggle state**

After the existing `const [matchMode, setMatchMode] = useState<"AND" | "OR">("AND");` (line 56), add:

```tsx
  const [showDuplicates, setShowDuplicates] = useState(false);
```

- [ ] **Step 3: Add a delete handler that updates the cache**

After the existing `handlePromote` function (ends line 177), add:

```tsx
  const handleDuplicatesDeleted = (ids: number[]) => {
    const idSet = new Set(ids);
    setFavorites((prev) => prev.filter((i) => !idSet.has(i.id)));
    setRecommendations((prev) => prev.filter((i) => !idSet.has(i.id)));
  };
```

- [ ] **Step 4: Add the "Find duplicates" toggle button**

In the GROUP controls row, immediately after the `</select>` that closes the GROUP dropdown (line 334), add a divider + button:

```tsx
            <div className="shrink-0" style={{ width: 1, height: 10, background: "#3d2815", margin: "0 1px" }} />
            <button
              onClick={() => setShowDuplicates((v) => { setSelectedAlbumId(null); return !v; })}
              className="font-mono shrink-0 cursor-pointer"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                letterSpacing: "0.08em",
                border: showDuplicates ? "1px solid #ff5e00" : "1px solid #3d2815",
                background: showDuplicates ? "rgba(255,94,0,0.1)" : "transparent",
                color: showDuplicates ? "#ff5e00" : "#907558",
              }}
            >
              DUPLICATES
            </button>
```

- [ ] **Step 5: Render the panel in place of the shelf when active**

Replace the shelf-content block. The current structure (lines 348-382) is:

```tsx
      {/* Shelf content */}
      <div style={{ paddingTop: 18, paddingBottom: 20 }}>
        {loading ? (
```

Change the opening of that block so the panel renders when `showDuplicates` is true:

```tsx
      {/* Shelf content */}
      <div style={{ paddingTop: 18, paddingBottom: 20 }}>
        {showDuplicates ? (
          <DuplicatesPanel
            items={allItems}
            pickStats={pickStats}
            onDeleted={handleDuplicatesDeleted}
            onClose={() => setShowDuplicates(false)}
          />
        ) : loading ? (
```

The rest of the existing ternary (`loading ? (...) : grouped.length === 0 ? (...) : (...)`) stays as-is; only the leading `showDuplicates ?` branch is added in front of it. The chain becomes `showDuplicates ? <panel> : loading ? <skeleton> : grouped.length === 0 ? <empty> : <shelves>`.

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all tests pass (existing `filters.test.ts` + new `duplicates.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/pages/Lists.tsx
git commit -m "feat: wire duplicates panel into library page"
```

---

## Self-Review Notes

- **Spec coverage:** Detection (exact + fuzzy, edition-suffix stripping) → Task 1. Inline panel placement, exact/fuzzy labels, per-item context, manual marking, "Delete N items" tally → Task 2. Batch delete via existing endpoint with `Promise.allSettled` + per-item error surfacing + cache update + re-scan (re-scan happens automatically because `groups` is a `useMemo` over `items`, and `items` shrinks when `onDeleted` updates the cache) → Tasks 2 & 3. Button placement in Lists header → Task 3.
- **No new endpoint:** Confirmed — only `deleteAlbum` reused.
- **Type consistency:** `DuplicateGroup`, `findDuplicateGroups`, `normalizeTitle`, `normalizeArtist`, `DuplicatesPanelProps`, `handleDuplicatesDeleted` are consistent across tasks. `pickStats` map shape matches `DataCache`.
- **YAGNI:** No auto-resolve, no keep-suggestions, no persistence — matches spec scope guardrails.

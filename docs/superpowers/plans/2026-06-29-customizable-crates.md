# Customizable Crates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recommendation lists ("crates") fully user-definable — each with its own filters, selection tuning, and final-pick strategy — replacing the hardcoded dashboard modes.

**Architecture:** Crates are JSON objects stored under a single `user_config` key (`crates`), persisted through the existing `PATCH /api/config`. A shared filter engine (`lib/filters.ts`) and a new crate engine (`lib/crateEngine.ts`) run on the server to turn each crate definition into N picks. The dashboard endpoint loops over crates instead of a hardcoded `switch`. The client gains a Crate Editor modal reused from both the Crates page and the Library tab.

**Tech Stack:** React 18 + TypeScript + Vite, Vercel serverless functions, Supabase Postgres, Anthropic SDK (Claude Haiku), Vitest (logic tests only — no React test harness).

## Global Constraints

- **Hobby plan: max 12 serverless functions.** Currently 11. Do NOT add a new API file — crate CRUD rides on existing `PATCH /api/config`.
- **No new DB table / migration.** Crates live in `user_config` JSONB under key `crates`.
- TypeScript throughout; no linter configured. Verify with `npm run build` (tsc via vite) and `npm test` (vitest).
- Serverless functions are stateless — no in-memory caches.
- Preserve graceful AI fallback: any AI strategy failure falls back to a weighted/random local pick.
- Match existing code style: inline-style React components, `font-mono`, color tokens (`#ff5e00`, `#907558`, `#f2e8d2`, `#3d2815`).

---

## File Structure

**Create:**
- `lib/filters.ts` — shared filter engine (moved from `src/lib/filters.ts`)
- `lib/crates.ts` — `CrateDefinition`/`Weighting`/`CrateStrategy` types, `DEFAULT_WEIGHTING`, `seedCratesFromConfig()`
- `lib/crateEngine.ts` — `runCrate()` orchestrator
- `lib/crates.test.ts` — seeding tests
- `lib/crateEngine.test.ts` — engine tests
- `src/components/CrateEditorModal.tsx` — create/edit modal

**Modify:**
- `lib/types.ts` — widen `Item.metadata` to allow `string`
- `lib/selection.ts` — add recently-added weighting knobs
- `lib/selection.test.ts` — (create) recency/recently-added tests
- `src/lib/filters.ts` — becomes a thin re-export of `../../lib/filters` (path adjusted)
- `src/lib/filters.test.ts` — re-point import if needed (stays green)
- `api/picks/dashboard.ts` — rewrite to loop over crates
- `src/types/index.ts` — add crate types, `DashboardData` crates shape
- `src/services/api.ts` — `getDashboard`/`getDashboardCrate`, `saveCrates`
- `src/contexts/DataCache.tsx` — crates-based dashboard state
- `src/pages/Crates.tsx` — render config-driven crates + edit/new controls
- `src/pages/Lists.tsx` — "Save as crate" button
- `src/pages/Settings.tsx` — remove global tuning + Right Now contexts

---

## Task 1: Shared crate types and seeding logic

**Files:**
- Create: `lib/crates.ts`
- Create: `lib/crates.test.ts`
- Modify: `lib/types.ts:13-26` (widen `Item.metadata`)

**Interfaces:**
- Consumes: `FilterRule` (from `lib/filters.ts`, defined in Task 2 — for now declare the type inline as shown; Task 2 keeps the same shape).
- Produces:
  - `interface Weighting { cooldown_days; weight_recent_days; weight_medium_days; weight_low; weight_medium; weight_high; weight_never_picked_bonus; recently_added_days; recently_added_bonus; randomness_factor }` (all `number`)
  - `type CrateStrategy = { type: "weighted"; weighting: Weighting } | { type: "random" } | { type: "ai_pool"; prompt?: string } | { type: "ai_new"; prompt?: string }`
  - `interface CrateFilters { rules: FilterRule[]; matchMode: "AND" | "OR" }`
  - `interface CrateDefinition { id: string; name: string; position: number; source: "library" | "friends"; count: number; filters: CrateFilters; strategy: CrateStrategy }`
  - `const DEFAULT_WEIGHTING: Weighting`
  - `function seedCratesFromConfig(config: Record<string, unknown>): CrateDefinition[]`

> Note: `lib/crates.ts` imports `FilterRule` from `./filters`. Implement Task 2 first if your toolchain rejects the forward reference; the two tasks are ordered 1→2 only for narrative. If you implement Task 1 first, temporarily `import type { FilterRule } from "./filters"` will fail to resolve — so **do Task 2's file move before running Task 1's tests.** Both files are committed together-safe.

- [ ] **Step 1: Widen `Item.metadata` in `lib/types.ts`**

In `lib/types.ts`, change the `Item` interface's metadata line:

```ts
  metadata: Record<string, unknown> | string | null;
```

(was `Record<string, unknown> | null`). This matches `src/types/index.ts` and how the filter engine already handles stringified metadata.

- [ ] **Step 2: Write the failing seeding test**

Create `lib/crates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { seedCratesFromConfig, DEFAULT_WEIGHTING } from "./crates";

const baseConfig = {
  cards_per_mode: 4,
  cooldown_days: 3,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 3,
  weight_high: 5,
  weight_never_picked_bonus: 2,
  randomness_factor: 1.0,
  contexts: ["gym", "cooking"],
  right_now_contexts: [
    { key: "gym", label: "Gym", emoji: "💪", prefer_genres: ["rock", "metal"] },
    { key: "cooking", label: "Cooking", emoji: "🍳", prefer_genres: ["jazz"] },
  ],
};

describe("seedCratesFromConfig", () => {
  it("creates favorites, discover, surprise, friends, and one crate per context", () => {
    const crates = seedCratesFromConfig(baseConfig);
    const names = crates.map((c) => c.name);
    expect(names).toContain("Favorites");
    expect(names).toContain("Discover");
    expect(names).toContain("Surprise Me");
    expect(names).toContain("From Friends");
    expect(names).toContain("Gym");
    expect(names).toContain("Cooking");
  });

  it("favorites crate filters list=favorite with weighted strategy and inherited count", () => {
    const fav = seedCratesFromConfig(baseConfig).find((c) => c.name === "Favorites")!;
    expect(fav.count).toBe(4);
    expect(fav.strategy.type).toBe("weighted");
    expect(fav.filters.rules).toEqual([
      expect.objectContaining({ field: "list", operator: "is", value: "favorite" }),
    ]);
  });

  it("surprise crate uses ai_new strategy", () => {
    const s = seedCratesFromConfig(baseConfig).find((c) => c.name === "Surprise Me")!;
    expect(s.strategy.type).toBe("ai_new");
  });

  it("friends crate has source=friends", () => {
    const f = seedCratesFromConfig(baseConfig).find((c) => c.name === "From Friends")!;
    expect(f.source).toBe("friends");
  });

  it("context crate filters by that context's genres (OR) with weighted strategy", () => {
    const gym = seedCratesFromConfig(baseConfig).find((c) => c.name === "Gym")!;
    expect(gym.filters.matchMode).toBe("OR");
    expect(gym.filters.rules.map((r) => r.value)).toEqual(["rock", "metal"]);
    expect(gym.filters.rules.every((r) => r.field === "genre" && r.operator === "is")).toBe(true);
    expect(gym.strategy.type).toBe("weighted");
  });

  it("inherits weighting values from config", () => {
    const fav = seedCratesFromConfig(baseConfig).find((c) => c.name === "Favorites")!;
    if (fav.strategy.type !== "weighted") throw new Error("expected weighted");
    expect(fav.strategy.weighting.cooldown_days).toBe(3);
    expect(fav.strategy.weighting.weight_high).toBe(5);
    expect(fav.strategy.weighting.recently_added_days).toBe(DEFAULT_WEIGHTING.recently_added_days);
  });

  it("assigns sequential positions and unique ids", () => {
    const crates = seedCratesFromConfig(baseConfig);
    expect(crates.map((c) => c.position)).toEqual(crates.map((_, i) => i));
    expect(new Set(crates.map((c) => c.id)).size).toBe(crates.length);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- crates`
Expected: FAIL — `Cannot find module './crates'`.

- [ ] **Step 4: Implement `lib/crates.ts`**

```ts
import type { FilterRule } from "./filters";

export interface Weighting {
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  weight_never_picked_bonus: number;
  recently_added_days: number;
  recently_added_bonus: number;
  randomness_factor: number;
}

export type CrateStrategy =
  | { type: "weighted"; weighting: Weighting }
  | { type: "random" }
  | { type: "ai_pool"; prompt?: string }
  | { type: "ai_new"; prompt?: string };

export interface CrateFilters {
  rules: FilterRule[];
  matchMode: "AND" | "OR";
}

export interface CrateDefinition {
  id: string;
  name: string;
  position: number;
  source: "library" | "friends";
  count: number;
  filters: CrateFilters;
  strategy: CrateStrategy;
}

export const DEFAULT_WEIGHTING: Weighting = {
  cooldown_days: 3,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 3,
  weight_high: 5,
  weight_never_picked_bonus: 2,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

function num(config: Record<string, unknown>, key: string, fallback: number): number {
  const v = config[key];
  return typeof v === "number" ? v : fallback;
}

function weightingFromConfig(config: Record<string, unknown>): Weighting {
  return {
    cooldown_days: num(config, "cooldown_days", DEFAULT_WEIGHTING.cooldown_days),
    weight_recent_days: num(config, "weight_recent_days", DEFAULT_WEIGHTING.weight_recent_days),
    weight_medium_days: num(config, "weight_medium_days", DEFAULT_WEIGHTING.weight_medium_days),
    weight_low: num(config, "weight_low", DEFAULT_WEIGHTING.weight_low),
    weight_medium: num(config, "weight_medium", DEFAULT_WEIGHTING.weight_medium),
    weight_high: num(config, "weight_high", DEFAULT_WEIGHTING.weight_high),
    weight_never_picked_bonus: num(config, "weight_never_picked_bonus", DEFAULT_WEIGHTING.weight_never_picked_bonus),
    recently_added_days: DEFAULT_WEIGHTING.recently_added_days,
    recently_added_bonus: DEFAULT_WEIGHTING.recently_added_bonus,
    randomness_factor: num(config, "randomness_factor", DEFAULT_WEIGHTING.randomness_factor),
  };
}

let seq = 0;
function makeId(): string {
  // Deterministic within one process call sequence; uniqueness across the seeded set is all we need.
  seq += 1;
  return `crate_seed_${seq}_${Math.floor(Math.random() * 1e6)}`;
}

interface SeedContext {
  key: string;
  label: string;
  emoji: string;
  prefer_genres: string[];
}

export function seedCratesFromConfig(config: Record<string, unknown>): CrateDefinition[] {
  const count = num(config, "cards_per_mode", 4);
  const weighting = weightingFromConfig(config);
  const crates: CrateDefinition[] = [];
  let position = 0;

  const push = (c: Omit<CrateDefinition, "position">) => {
    crates.push({ ...c, position: position++ });
  };

  push({
    id: makeId(),
    name: "Favorites",
    source: "library",
    count,
    filters: { rules: [{ id: "r1", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" },
    strategy: { type: "weighted", weighting: { ...weighting } },
  });

  push({
    id: makeId(),
    name: "Discover",
    source: "library",
    count,
    filters: { rules: [{ id: "r1", field: "list", operator: "is", value: "recommendation" }], matchMode: "AND" },
    strategy: { type: "weighted", weighting: { ...weighting } },
  });

  push({
    id: makeId(),
    name: "Surprise Me",
    source: "library",
    count,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "ai_new" },
  });

  const rightNow = (config.right_now_contexts as SeedContext[] | undefined) ?? [];
  const activeKeys = (config.contexts as string[] | undefined) ?? rightNow.map((c) => c.key);
  for (const ctx of rightNow) {
    if (!activeKeys.includes(ctx.key)) continue;
    push({
      id: makeId(),
      name: ctx.label,
      source: "library",
      count,
      filters: {
        rules: ctx.prefer_genres.map((g, i) => ({ id: `r${i + 1}`, field: "genre" as const, operator: "is", value: g })),
        matchMode: "OR",
      },
      strategy: { type: "weighted", weighting: { ...weighting } },
    });
  }

  push({
    id: makeId(),
    name: "From Friends",
    source: "friends",
    count,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "random" },
  });

  return crates;
}
```

> `FilterRule` is `{ id: string; field: FieldKey; operator: string; value: string; value2?: string }` — defined in Task 2. The `field: "list" | "genre"` literals above are valid `FieldKey` values.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- crates`
Expected: PASS (7 tests). If module resolution for `./filters` fails, complete Task 2 first, then re-run.

- [ ] **Step 6: Commit**

```bash
git add lib/crates.ts lib/crates.test.ts lib/types.ts
git commit -m "feat: crate types and config seeding logic"
```

---

## Task 2: Move filter engine to shared lib

**Files:**
- Create: `lib/filters.ts` (moved content)
- Modify: `src/lib/filters.ts` → re-export
- Modify: `src/lib/filters.test.ts:2` (no change needed — still imports `./filters`)

**Interfaces:**
- Produces (unchanged from current `src/lib/filters.ts`): `FieldKey`, `FilterRule`, `PickStat`, `FIELD_DEFS`, `getItemYear`, `getItemGenres`, `makeRuleId`, `applyFilters`.

- [ ] **Step 1: Create `lib/filters.ts` with the moved engine**

Copy the entire current contents of `src/lib/filters.ts` into a new file `lib/filters.ts`, changing only the `Item` import path on line 1:

```ts
import type { Item } from "./types";
```

(was `import type { Item } from "../types";`). Everything else — `FieldKey`, `FilterRule`, `PickStat`, `FIELD_DEFS`, `parseMeta`, `getItemYear`, `getItemGenres`, `makeRuleId`, `ruleIsComplete`, `evaluate`, `applyFilters` — is identical.

- [ ] **Step 2: Replace `src/lib/filters.ts` with a re-export**

```ts
// Re-exports the shared filter engine so client code keeps importing from "../lib/filters".
export * from "../../lib/filters";
export type { FieldKey, FilterRule, PickStat } from "../../lib/filters";
```

- [ ] **Step 3: Run the existing filter tests**

Run: `npm test -- filters`
Expected: PASS — all tests in `src/lib/filters.test.ts` (they import `./filters`, which now re-exports the shared engine). The `Item` type used in the test comes from `src/types`; since `lib/types` `Item.metadata` now also allows `string` (Task 1 Step 1), structural typing holds.

- [ ] **Step 4: Typecheck the whole project**

Run: `npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/filters.ts src/lib/filters.ts
git commit -m "refactor: move filter engine to shared lib for server use"
```

---

## Task 3: Extend selection.ts with recently-added weighting

**Files:**
- Modify: `lib/selection.ts:5-14` (SelectionConfig), `:74-103` (weight loop)
- Create: `lib/selection.test.ts`

**Interfaces:**
- Consumes: `Item`, `LastPickInfo` (from `lib/types`), `Weighting` is structurally compatible with `SelectionConfig`.
- Produces: `SelectionConfig` gains `recently_added_days: number; recently_added_bonus: number`. `selectAlbums(pool, count, picks, config)` signature unchanged.

- [ ] **Step 1: Write failing tests for the recently-added bonus**

Create `lib/selection.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { selectAlbums, type SelectionConfig } from "./selection";
import type { Item } from "./types";

function item(over: Partial<Item>): Item {
  return {
    id: 1, user_id: 1, media_type: "album", list_type: "favorite",
    title: "T", creator: "A", image_url: null, external_id: "x",
    external_uri: null, external_url: null, added_at: 0, metadata: null,
    ...over,
  };
}

const base: SelectionConfig = {
  cooldown_days: 0,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 1,
  weight_high: 1,
  weight_never_picked_bonus: 0,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

afterEach(() => vi.restoreAllMocks());

describe("selectAlbums recently-added bonus", () => {
  it("with zero bonus, never returns more than the pool size", () => {
    const pool = [item({ id: 1 }), item({ id: 2 })];
    const res = selectAlbums(pool, 5, [], base);
    expect(res.length).toBe(2);
  });

  it("a recently-added album with a large bonus is overwhelmingly favored", () => {
    // Freeze randomness so weighting, not chance, decides.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const now = Math.floor(Date.now() / 1000);
    const old = item({ id: 1, added_at: now - 60 * 86400 });   // added 60 days ago
    const fresh = item({ id: 2, added_at: now - 1 * 86400 });  // added yesterday
    const cfg: SelectionConfig = { ...base, recently_added_days: 14, recently_added_bonus: 100 };
    const [first] = selectAlbums([old, fresh], 1, [], cfg);
    expect(first.id).toBe(2);
  });

  it("recently-added bonus does not apply to albums added long ago", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const now = Math.floor(Date.now() / 1000);
    const a = item({ id: 1, added_at: now - 60 * 86400 });
    const b = item({ id: 2, added_at: now - 60 * 86400 });
    const cfg: SelectionConfig = { ...base, recently_added_bonus: 100 };
    const res = selectAlbums([a, b], 2, [], cfg);
    expect(res.map((i) => i.id).sort()).toEqual([1, 2]); // both eligible, neither boosted out of range
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- selection`
Expected: FAIL — `recently_added_days`/`recently_added_bonus` not on `SelectionConfig` (type error) or the favored-album assertion fails.

- [ ] **Step 3: Add the knobs to `SelectionConfig`**

In `lib/selection.ts`, extend the interface (after `weight_never_picked_bonus`):

```ts
export interface SelectionConfig {
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  weight_never_picked_bonus: number;
  recently_added_days: number;
  recently_added_bonus: number;
  randomness_factor: number;
}
```

- [ ] **Step 4: Apply the recently-added bonus in the weight loop**

In `lib/selection.ts`, destructure the new fields and add the bonus. Replace the destructuring block and the never-picked block:

```ts
  const {
    cooldown_days,
    weight_recent_days,
    weight_medium_days,
    weight_low,
    weight_medium,
    weight_high,
    weight_never_picked_bonus,
    recently_added_days,
    recently_added_bonus,
    randomness_factor,
  } = config;
```

Then, inside the `for (const item of pool)` loop, after the `if (neverPicked) { weight += weight_never_picked_bonus; }` block and before `if (weight > 0)`:

```ts
    if (recently_added_bonus > 0 && item.added_at) {
      const addedDaysAgo = daysAgo(item.added_at);
      if (addedDaysAgo <= recently_added_days) {
        weight += recently_added_bonus;
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- selection`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/selection.ts lib/selection.test.ts
git commit -m "feat: add recently-added weighting to album selection"
```

---

## Task 4: Crate engine (runCrate)

**Files:**
- Create: `lib/crateEngine.ts`
- Create: `lib/crateEngine.test.ts`

**Interfaces:**
- Consumes: `CrateDefinition` (Task 1), `applyFilters`/`PickStat` (Task 2), `selectAlbums`/`SelectionConfig` (Task 3), `Item`/`LastPickInfo` (lib/types).
- Produces:
  - `interface CrateEngineDeps { aiPoolPick(prompt: string | undefined, pool: Item[], count: number): Promise<Item[]>; aiNewPick(prompt: string | undefined, library: Item[], count: number): Promise<Item[]>; friendPicks(count: number): Promise<Item[]>; }`
  - `function buildPickStats(picks: LastPickInfo[]): Map<number, PickStat>`
  - `async function runCrate(crate: CrateDefinition, allItems: Item[], picks: LastPickInfo[], deps: CrateEngineDeps): Promise<Item[]>`

> The AI/friends operations are injected as `deps` so the engine is unit-testable with stubs and the real Anthropic/Spotify/DB calls stay in `dashboard.ts`.

- [ ] **Step 1: Write failing engine tests**

Create `lib/crateEngine.test.ts`:

```ts
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

  it("source=friends calls friendPicks and ignores filters", async () => {
    const friendPicks = vi.fn().mockResolvedValue([item({ id: 7 })]);
    const c = crate({ source: "friends", count: 4, filters: { rules: [{ id: "r", field: "list", operator: "is", value: "favorite" }], matchMode: "AND" } });
    const res = await runCrate(c, library, [], { ...noDeps, friendPicks });
    expect(friendPicks).toHaveBeenCalledWith(4);
    expect(res[0].id).toBe(7);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- crateEngine`
Expected: FAIL — `Cannot find module './crateEngine'`.

- [ ] **Step 3: Implement `lib/crateEngine.ts`**

```ts
import type { Item, LastPickInfo } from "./types";
import type { CrateDefinition } from "./crates";
import { applyFilters, type PickStat } from "./filters";
import { selectAlbums, type SelectionConfig } from "./selection";

export interface CrateEngineDeps {
  aiPoolPick(prompt: string | undefined, pool: Item[], count: number): Promise<Item[]>;
  aiNewPick(prompt: string | undefined, library: Item[], count: number): Promise<Item[]>;
  friendPicks(count: number): Promise<Item[]>;
}

export function buildPickStats(picks: LastPickInfo[]): Map<number, PickStat> {
  const map = new Map<number, PickStat>();
  for (const p of picks) {
    map.set(p.item_id, { pickCount: p.pick_count, lastPickedTs: p.picked_at });
  }
  return map;
}

function randomSample(pool: Item[], count: number): Item[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

export async function runCrate(
  crate: CrateDefinition,
  allItems: Item[],
  picks: LastPickInfo[],
  deps: CrateEngineDeps
): Promise<Item[]> {
  if (crate.source === "friends") {
    try {
      return await deps.friendPicks(crate.count);
    } catch {
      return [];
    }
  }

  const pickStats = buildPickStats(picks);
  const pool = applyFilters(allItems, crate.filters.rules, crate.filters.matchMode, pickStats);

  switch (crate.strategy.type) {
    case "random":
      return randomSample(pool, crate.count);

    case "weighted": {
      const config: SelectionConfig = crate.strategy.weighting;
      return selectAlbums(pool, crate.count, picks, config);
    }

    case "ai_pool": {
      try {
        return await deps.aiPoolPick(crate.strategy.prompt, pool, crate.count);
      } catch {
        return randomSample(pool, crate.count);
      }
    }

    case "ai_new": {
      try {
        return await deps.aiNewPick(crate.strategy.prompt, allItems, crate.count);
      } catch {
        return randomSample(pool, crate.count);
      }
    }

    default:
      return randomSample(pool, crate.count);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- crateEngine`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/crateEngine.ts lib/crateEngine.test.ts
git commit -m "feat: crate engine orchestrating filters and strategies"
```

---

## Task 5: Rewrite the dashboard endpoint

**Files:**
- Modify: `api/picks/dashboard.ts` (full rewrite)
- Modify: `lib/claude.ts` (add `getPoolSuggestions` for `ai_pool` with optional prompt; generalize `getSurpriseSuggestion` call site)

**Interfaces:**
- Consumes: `seedCratesFromConfig` (Task 1), `runCrate`/`CrateEngineDeps` (Task 4), `getContextSuggestions`/`getSurpriseSuggestion` (`lib/claude`), `getPendingFriendRecommendations`/`setConfig` (`lib/queries`).
- Produces: response shape `{ crates: { id: string; items: Item[] }[], _config, _picks }`. Single-crate refresh via `?crateId=<id>`.

- [ ] **Step 1: Add an AI pool-suggestion helper in `lib/claude.ts`**

Append to `lib/claude.ts`:

```ts
const POOL_SYSTEM_PROMPT = `You are a music curator for an album-picker app called Crates.
From the user's provided list of albums, choose the ones that best fit the user's described vibe.
Return ONLY a JSON array of the chosen albums' "id" values (numbers), most-fitting first.
No explanation, no markdown, just the raw JSON array of numbers.`;

export async function getPoolSuggestions(
  prompt: string | undefined,
  pool: Item[],
  count: number,
  recentPicks: LastPickInfo[],
  selectionConfig: SelectionConfig
): Promise<Item[]> {
  // No prompt → behave like a weighted pick from the pool.
  if (!prompt || pool.length === 0) {
    return selectAlbums(pool, count, recentPicks, selectionConfig);
  }

  const payload = pool.slice(0, 60).map((i) => ({
    id: i.id,
    title: i.title,
    artist: i.creator,
    genres: ((typeof i.metadata === "object" && i.metadata ? (i.metadata as Record<string, unknown>).genres : []) as string[]) || [],
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: POOL_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Vibe: ${prompt}\n\nMy albums:\n${JSON.stringify(payload)}\n\nChoose up to ${count}.` },
      ],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const ids = JSON.parse(text) as unknown;
    if (Array.isArray(ids)) {
      const byId = new Map(pool.map((i) => [i.id, i]));
      const chosen = ids
        .map((id) => byId.get(Number(id)))
        .filter((i): i is Item => Boolean(i))
        .slice(0, count);
      if (chosen.length > 0) return chosen;
    }
  } catch {
    // fall through
  }
  return selectAlbums(pool, count, recentPicks, selectionConfig);
}
```

- [ ] **Step 2: Rewrite `api/picks/dashboard.ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getItems, getLastPicksForUser, getPendingFriendRecommendations, setConfig } from "../../lib/queries";
import { runCrate, type CrateEngineDeps } from "../../lib/crateEngine";
import { seedCratesFromConfig, type CrateDefinition } from "../../lib/crates";
import { getPoolSuggestions, getSurpriseSuggestion } from "../../lib/claude";
import { searchAlbums, getBestImageUrl } from "../../lib/spotify";
import type { Item } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const requestedCrateId = (req.query.crateId as string) || null;

  const [config, allItems, recentPicks] = await Promise.all([
    getAllConfig(user.id),
    getItems(user.id),
    getLastPicksForUser(user.id),
  ]);

  // Seed crates on first load, persist so subsequent loads are stable.
  let crates = config.crates as CrateDefinition[] | undefined;
  if (!crates || !Array.isArray(crates) || crates.length === 0) {
    crates = seedCratesFromConfig(config);
    await setConfig(user.id, "crates", crates);
  }

  crates = [...crates].sort((a, b) => a.position - b.position);

  const existingIds = new Set(allItems.map((i) => i.external_id));

  const deps: CrateEngineDeps = {
    aiPoolPick: (prompt, pool, count) =>
      getPoolSuggestions(prompt, pool, count, recentPicks, /* weighting */ poolSelectionConfig(crates!, pool)),
    aiNewPick: async (prompt, library, count) => {
      const favorites = library.filter((i) => i.list_type === "favorite");
      const seed = favorites.length > 0 ? favorites : library;
      const suggestions = await getSurpriseSuggestion(seed);
      const shuffled = [...suggestions].sort(() => Math.random() - 0.5);
      const searchResults = await Promise.all(
        shuffled.map(({ title, artist }) => searchAlbums(`${title} ${artist}`, 5).catch(() => []))
      );
      const picks: Item[] = [];
      for (let i = 0; i < shuffled.length && picks.length < count; i++) {
        const match = searchResults[i].find((r) => !existingIds.has(r.id));
        if (match) {
          picks.push({
            id: 0, user_id: user.id, media_type: "album", list_type: "recommendation",
            title: match.name, creator: match.artists[0]?.name || shuffled[i].artist,
            image_url: getBestImageUrl(match.images), external_id: match.id,
            external_uri: match.uri, external_url: match.external_urls.spotify,
            added_at: Date.now(), metadata: { _ai_suggested: true },
          });
        }
      }
      if (picks.length === 0) throw new Error("no ai_new matches");
      return picks;
    },
    friendPicks: async (count) => {
      const recs = await getPendingFriendRecommendations(user.id, count);
      return recs.map((rec) => ({
        id: rec.id, user_id: user.id, media_type: "album", list_type: "recommendation" as const,
        title: rec.title, creator: rec.creator, image_url: rec.image_url,
        external_id: rec.external_id, external_uri: rec.external_uri, external_url: rec.external_url,
        added_at: rec.sent_at,
        metadata: { _friend_rec: true, _rec_id: rec.id, _sender_name: rec.sender_display_name },
      }));
    },
  };

  const cratesToRun = requestedCrateId ? crates.filter((c) => c.id === requestedCrateId) : crates;

  const results = await Promise.all(
    cratesToRun.map(async (c) => ({ id: c.id, items: await runCrate(c, allItems, recentPicks, deps) }))
  );

  res.json({ crates: results, _config: config, _picks: recentPicks });
}

// Pick a reasonable weighting for ai_pool fallback: use the crate's own weighting if weighted,
// otherwise neutral defaults.
import { DEFAULT_WEIGHTING } from "../../lib/crates";
import type { SelectionConfig } from "../../lib/selection";
function poolSelectionConfig(_crates: CrateDefinition[], _pool: Item[]): SelectionConfig {
  return DEFAULT_WEIGHTING;
}
```

> The `poolSelectionConfig` indirection keeps the fallback weighting explicit; ai_pool crates don't carry a `weighting` field, so neutral `DEFAULT_WEIGHTING` is the correct fallback for the weighted-pick fallback path.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors. (Fix import ordering if tsc complains about the late `import` statements — move them to the top of the file.)

- [ ] **Step 4: Run full test suite (no regressions)**

Run: `npm test`
Expected: PASS — all existing + new tests.

- [ ] **Step 5: Commit**

```bash
git add api/picks/dashboard.ts lib/claude.ts
git commit -m "feat: dashboard endpoint runs user-defined crates"
```

---

## Task 6: Client types, API service, and DataCache

**Files:**
- Modify: `src/types/index.ts` (add crate types; new `DashboardData`)
- Modify: `src/services/api.ts:149-160, 225-236`
- Modify: `src/contexts/DataCache.tsx`

**Interfaces:**
- Consumes: server response `{ crates: { id; items }[], _config, _picks }`.
- Produces:
  - `src/types`: `Weighting`, `CrateStrategy`, `CrateFilters`, `CrateDefinition` (mirror of `lib/crates.ts`), and `interface DashboardData { crates?: { id: string; items: Item[] }[]; _config?: AppConfig; _picks?: PickStat[] }`. `AppConfig` gains `crates?: CrateDefinition[]`.
  - `api.ts`: `getDashboard(): Promise<DashboardData>`, `getDashboardCrate(crateId: string): Promise<DashboardData>`, `saveCrates(crates: CrateDefinition[]): Promise<{ config: AppConfig }>`.
  - `DataCache`: `cratesData: Map<string, Item[]>`, `loadDashboard()`, `refreshCrate(crateId)`, `crateDefs: CrateDefinition[]`, `saveCrateDefs(next)`.

- [ ] **Step 1: Add crate types to `src/types/index.ts`**

Add (mirror Task 1's shapes — `FilterRule` is imported from the filters module):

```ts
import type { FilterRule } from "../lib/filters";

export interface Weighting {
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  weight_never_picked_bonus: number;
  recently_added_days: number;
  recently_added_bonus: number;
  randomness_factor: number;
}

export type CrateStrategy =
  | { type: "weighted"; weighting: Weighting }
  | { type: "random" }
  | { type: "ai_pool"; prompt?: string }
  | { type: "ai_new"; prompt?: string };

export interface CrateFilters { rules: FilterRule[]; matchMode: "AND" | "OR"; }

export interface CrateDefinition {
  id: string;
  name: string;
  position: number;
  source: "library" | "friends";
  count: number;
  filters: CrateFilters;
  strategy: CrateStrategy;
}
```

Change `DashboardData` to:

```ts
export interface DashboardData {
  crates?: { id: string; items: Item[] }[];
  _config?: AppConfig;
  _picks?: PickStat[];
}
```

Add `crates?: CrateDefinition[];` to the `AppConfig` interface.

- [ ] **Step 2: Update `src/services/api.ts`**

Replace `getDashboard` and `getDashboardMode` (lines 149-160) with:

```ts
export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/picks/dashboard");
}

export async function getDashboardCrate(crateId: string): Promise<DashboardData> {
  const params = new URLSearchParams({ crateId });
  return request<DashboardData>(`/picks/dashboard?${params}`);
}
```

Add a `saveCrates` helper near `updateConfig`:

```ts
export async function saveCrates(crates: CrateDefinition[]): Promise<{ config: AppConfig }> {
  return request<{ config: AppConfig }>("/config", {
    method: "PATCH",
    body: JSON.stringify({ crates }),
  });
}
```

Add `CrateDefinition` to the type import block at the top of `api.ts`.

> Any other caller of `getDashboardMode` is removed in this task (only DataCache uses it). Grep to confirm: `grep -rn getDashboardMode src/`.

- [ ] **Step 3: Rewrite the dashboard portion of `src/contexts/DataCache.tsx`**

Replace the dashboard-related state and callbacks:

```ts
import { getDashboard, getDashboardCrate, getAlbums, getHistory, getConfig, saveCrates } from "../services/api";
import type { Item, DashboardData, AppConfig, PickHistoryEntry, PickStat, CrateDefinition } from "../types";
```

State:

```ts
  const [cratesData, setCratesData] = useState<Map<string, Item[]>>(new Map());
  const [crateDefs, setCrateDefs] = useState<CrateDefinition[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<AppConfig | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [rawPickStats, setRawPickStats] = useState<PickStat[]>([]);
```

Callbacks:

```ts
  const loadDashboard = useCallback(async () => {
    try {
      const result = await getDashboard();
      if (result._config) {
        setDashboardConfig(result._config);
        setCrateDefs((result._config.crates ?? []).slice().sort((a, b) => a.position - b.position));
      }
      if (result._picks) setRawPickStats(result._picks);
      const map = new Map<string, Item[]>();
      for (const c of result.crates ?? []) map.set(c.id, c.items);
      setCratesData(map);
      setDashboardLoaded(true);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
  }, []);

  const refreshCrate = useCallback(async (crateId: string) => {
    try {
      const result = await getDashboardCrate(crateId);
      const got = result.crates?.find((c) => c.id === crateId);
      if (got) setCratesData((prev) => new Map(prev).set(crateId, got.items));
    } catch (err) {
      console.error("Failed to refresh crate:", err);
    }
  }, []);

  const saveCrateDefs = useCallback(async (next: CrateDefinition[]) => {
    const { config } = await saveCrates(next);
    setDashboardConfig(config);
    setCrateDefs((config.crates ?? []).slice().sort((a, b) => a.position - b.position));
  }, []);
```

Update the `DataCacheState` interface and the provider `value` to expose `cratesData`, `crateDefs`, `loadDashboard` (now no args), `refreshCrate`, `saveCrateDefs`; remove `dashboardData`, `refreshDashboardMode`. Keep `pickStats`, `loadConfig`, lists, history unchanged.

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: TypeScript errors ONLY in `src/pages/Crates.tsx`, `src/pages/Settings.tsx`, `src/pages/Lists.tsx` (they still reference the old API). These are fixed in Tasks 7-10. Confirm no errors in `api.ts`, `DataCache.tsx`, `types/index.ts`.

> Because the page fixes come in later tasks, this task is committed with known downstream type errors. That's acceptable mid-plan; the build is made fully green by Task 10. If you prefer a green build per commit, implement Tasks 6-10 as one batch before building.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/api.ts src/contexts/DataCache.tsx
git commit -m "feat: client crate types, API, and data cache wiring"
```

---

## Task 7: Crate Editor modal

**Files:**
- Create: `src/components/CrateEditorModal.tsx`

**Interfaces:**
- Consumes: `CrateDefinition`, `Weighting`, `CrateStrategy` (`src/types`); `AdvancedFilters` (`src/components/library/AdvancedFilters`); `DEFAULT_WEIGHTING` equivalent.
- Produces:
  - `interface CrateEditorModalProps { initial: CrateDefinition; availableGenres: string[]; onSave: (crate: CrateDefinition) => void; onDelete?: (id: string) => void; onClose: () => void; }`
  - `export const CLIENT_DEFAULT_WEIGHTING: Weighting` (re-declared client-side so the modal has no server import)
  - `export function makeEmptyCrate(position: number): CrateDefinition`
  - `export function CrateEditorModal(props: CrateEditorModalProps)`

- [ ] **Step 1: Create the modal**

Create `src/components/CrateEditorModal.tsx`. It reuses `AdvancedFilters` for filter rules and renders the strategy controls. Slider value-mapping mirrors `Settings.tsx` (`COOLDOWN_STOPS`, `VARIETY_STOPS`, `DISCOVERY_STOPS`).

```tsx
import React, { useState } from "react";
import AdvancedFilters from "./library/AdvancedFilters";
import type { CrateDefinition, Weighting, CrateStrategy } from "../types";
import type { FilterRule } from "../lib/filters";

export const CLIENT_DEFAULT_WEIGHTING: Weighting = {
  cooldown_days: 3,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 3,
  weight_high: 5,
  weight_never_picked_bonus: 2,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

export function makeEmptyCrate(position: number): CrateDefinition {
  return {
    id: `crate_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: "",
    position,
    source: "library",
    count: 4,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "weighted", weighting: { ...CLIENT_DEFAULT_WEIGHTING } },
  };
}

const COOLDOWN_STOPS = [0, 3, 7, 14, 31];
const COOLDOWN_LABELS = ["None", "A few days", "A week", "Two weeks", "A month"];
const VARIETY_STOPS = [2.0, 1.5, 1.0, 0.7, 0.4];
const VARIETY_LABELS = ["Predictable", "Consistent", "Balanced", "Random", "Chaotic"];
const DISCOVERY_STOPS = [0, 1, 2, 3, 5];
const DISCOVERY_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];
const FRESH_STOPS = [0, 1, 2, 3, 5];
const FRESH_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];

function nearestIdx(value: number, stops: number[]): number {
  return stops.reduce((best, v, i) => (Math.abs(v - value) < Math.abs(stops[best] - value) ? i : best), 0);
}

type StrategyType = CrateStrategy["type"];
const STRATEGY_OPTIONS: { key: StrategyType; label: string }[] = [
  { key: "weighted", label: "WEIGHTED" },
  { key: "random", label: "RANDOM" },
  { key: "ai_pool", label: "AI · LIBRARY" },
  { key: "ai_new", label: "AI · NEW" },
];

interface CrateEditorModalProps {
  initial: CrateDefinition;
  availableGenres: string[];
  onSave: (crate: CrateDefinition) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function CrateEditorModal({ initial, availableGenres, onSave, onDelete, onClose }: CrateEditorModalProps) {
  const [name, setName] = useState(initial.name);
  const [count, setCount] = useState(initial.count);
  const [rules, setRules] = useState<FilterRule[]>(initial.filters.rules);
  const [matchMode, setMatchMode] = useState<"AND" | "OR">(initial.filters.matchMode);
  const [strategyType, setStrategyType] = useState<StrategyType>(initial.strategy.type);
  const [weighting, setWeighting] = useState<Weighting>(
    initial.strategy.type === "weighted" ? initial.strategy.weighting : { ...CLIENT_DEFAULT_WEIGHTING }
  );
  const [prompt, setPrompt] = useState<string>(
    initial.strategy.type === "ai_pool" || initial.strategy.type === "ai_new" ? initial.strategy.prompt ?? "" : ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cooldownIdx = nearestIdx(weighting.cooldown_days, COOLDOWN_STOPS);
  const varietyIdx = nearestIdx(weighting.randomness_factor, VARIETY_STOPS);
  const discoveryIdx = nearestIdx(weighting.weight_never_picked_bonus, DISCOVERY_STOPS);
  const freshIdx = nearestIdx(weighting.recently_added_bonus, FRESH_STOPS);

  function buildStrategy(): CrateStrategy {
    if (strategyType === "weighted") return { type: "weighted", weighting };
    if (strategyType === "random") return { type: "random" };
    return { type: strategyType, prompt: prompt.trim() || undefined };
  }

  function handleSave() {
    onSave({
      ...initial,
      name: name.trim() || "Untitled Crate",
      count,
      filters: { rules, matchMode },
      strategy: buildStrategy(),
    });
  }

  const label: React.CSSProperties = {
    fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.2em",
    textTransform: "uppercase", color: "#907558", display: "block", marginBottom: 6,
  };
  const input: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(61,40,21,0.8)", borderRadius: 4,
    color: "#f2e8d2", fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, padding: "6px 10px",
    width: "100%", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-y-auto"
        style={{ background: "#140d0a", border: "1px solid #3d2815", borderRadius: 10, maxHeight: "90vh", padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-display" style={{ fontSize: 16, color: "#f2e8d2", letterSpacing: "0.15em" }}>
            {initial.name ? "EDIT CRATE" : "NEW CRATE"}
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#907558", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label style={label}>Name</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Crate" />
        </div>

        {/* Count */}
        <div className="mb-4">
          <label style={label}>Albums per crate</label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  width: 36, height: 36, borderRadius: 4, cursor: "pointer",
                  border: count === n ? "1px solid #ff5e00" : "1px solid rgba(61,40,21,0.8)",
                  background: count === n ? "rgba(255,94,0,0.12)" : "transparent",
                  color: count === n ? "#ff5e00" : "#907558",
                  fontFamily: '"IBM Plex Mono", monospace', fontSize: 13,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <label style={label}>Filters</label>
          <AdvancedFilters
            rules={rules}
            matchMode={matchMode}
            availableGenres={availableGenres}
            onChangeRules={setRules}
            onChangeMatchMode={setMatchMode}
          />
        </div>

        {/* Strategy */}
        <div className="mb-4">
          <label style={label}>Pick strategy</label>
          <div className="flex gap-1 flex-wrap">
            {STRATEGY_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setStrategyType(o.key)}
                className="font-mono cursor-pointer"
                style={{
                  fontSize: 10, padding: "4px 8px", letterSpacing: "0.08em",
                  border: strategyType === o.key ? "1px solid #ff5e00" : "1px solid #3d2815",
                  background: strategyType === o.key ? "rgba(255,94,0,0.1)" : "transparent",
                  color: strategyType === o.key ? "#ff5e00" : "#907558",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy detail */}
        {strategyType === "weighted" && (
          <div className="mb-4 flex flex-col gap-4">
            <Slider label="Cooldown" valueLabel={`${COOLDOWN_LABELS[cooldownIdx]} (${COOLDOWN_STOPS[cooldownIdx]}d)`}
              idx={cooldownIdx} onChange={(i) => setWeighting((w) => ({ ...w, cooldown_days: COOLDOWN_STOPS[i] }))} />
            <Slider label="Variety" valueLabel={VARIETY_LABELS[varietyIdx]}
              idx={varietyIdx} onChange={(i) => setWeighting((w) => ({ ...w, randomness_factor: VARIETY_STOPS[i] }))} />
            <Slider label="Discovery bias" valueLabel={DISCOVERY_LABELS[discoveryIdx]}
              idx={discoveryIdx} onChange={(i) => setWeighting((w) => ({ ...w, weight_never_picked_bonus: DISCOVERY_STOPS[i] }))} />
            <Slider label="Recently added" valueLabel={FRESH_LABELS[freshIdx]}
              idx={freshIdx} onChange={(i) => setWeighting((w) => ({ ...w, recently_added_bonus: FRESH_STOPS[i] }))} />
          </div>
        )}

        {(strategyType === "ai_pool" || strategyType === "ai_new") && (
          <div className="mb-4">
            <label style={label}>Vibe / prompt (optional)</label>
            <input style={input} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. rainy Sunday morning" />
            <p className="font-mono" style={{ fontSize: 10, color: "#907558", marginTop: 6 }}>
              {strategyType === "ai_pool"
                ? "AI picks from your filtered albums. Blank = weighted pick."
                : "AI suggests albums outside your library."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button onClick={() => onDelete(initial.id)} className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 8px", color: "#ff4444", border: "1px solid rgba(255,68,68,0.4)", background: "transparent", borderRadius: 3 }}>
                  DELETE
                </button>
                <button onClick={() => setConfirmDelete(false)} className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 8px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 3 }}>
                  CANCEL
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="font-mono cursor-pointer"
                style={{ fontSize: 10, padding: "4px 8px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 3 }}>
                DELETE CRATE
              </button>
            )
          ) : <span />}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="font-mono cursor-pointer"
              style={{ fontSize: 10, padding: "6px 12px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 4 }}>
              CANCEL
            </button>
            <button onClick={handleSave} className="font-mono cursor-pointer"
              style={{ fontSize: 10, padding: "6px 12px", color: "#ff5e00", border: "1px solid rgba(255,94,0,0.6)", background: "rgba(255,94,0,0.12)", borderRadius: 4, letterSpacing: "0.1em" }}>
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, valueLabel, idx, onChange }: { label: string; valueLabel: string; idx: number; onChange: (i: number) => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#f2e8d2" }}>{label}</span>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#ff5e00" }}>{valueLabel}</span>
      </div>
      <input type="range" className="algo-slider" min={0} max={4} step={1} value={idx}
        style={{ width: "100%" }}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
```

> The `.algo-slider` CSS lives in `Settings.tsx` today. Move that `sliderStyle` string into a small shared injection: add `<style>{sliderStyle}</style>` inside this modal (copy the CSS block from `Settings.tsx:51-85`) so the slider renders correctly wherever the modal is used.

- [ ] **Step 2: Add the slider style to the modal**

Copy the `sliderStyle` template string from `Settings.tsx` (lines 51-85) into `CrateEditorModal.tsx` as a module const and render `<style>{sliderStyle}</style>` as the first child inside the modal's outer `div`.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: no NEW errors in `CrateEditorModal.tsx` (page errors from Task 6 may still remain until Tasks 8-10).

- [ ] **Step 4: Commit**

```bash
git add src/components/CrateEditorModal.tsx
git commit -m "feat: crate editor modal"
```

---

## Task 8: Crates page — render config-driven crates

**Files:**
- Modify: `src/pages/Crates.tsx`

**Interfaces:**
- Consumes: `cratesData`, `crateDefs`, `loadDashboard`, `refreshCrate`, `saveCrateDefs`, `pickStats` (DataCache); `CrateEditorModal`, `makeEmptyCrate` (Task 7).
- Produces: none (page component).

- [ ] **Step 1: Rewrite the page to iterate `crateDefs`**

Key changes to `src/pages/Crates.tsx`:
- Replace `dashboardData`/`refreshDashboardMode`/`CRATE_META`/context-pill logic with `crateDefs` + `cratesData` from `useDataCache()`.
- `useEffect` calls `loadDashboard()` (no args) when `!dashboardLoaded`.
- Map over `crateDefs` (already sorted). For each crate render the existing `CrateSection` visual, passing `items={cratesData.get(crate.id) ?? []}`, `name={crate.name}`, `desc=""` (or a derived strategy label), `onRefresh={() => refreshCrate(crate.id)}`.
- Remove the context pills block and all `for_right_now`/context state.
- Add a pencil/edit button to each crate header that opens `CrateEditorModal` with `initial={crate}`.
- Add a "+ New Crate" button (reuse the header `+` styling) that opens the modal with `makeEmptyCrate(crateDefs.length)` and no `onDelete`.
- Modal `onSave={(crate) => { const next = upsert(crateDefs, crate); saveCrateDefs(next).then(() => refreshCrate(crate.id)); setEditing(null); }}`.
- Modal `onDelete={(id) => { saveCrateDefs(crateDefs.filter(c => c.id !== id)); setEditing(null); }}`.
- `availableGenres` for the modal: derive from `favorites`+`recommendations` (load lists if needed, same pattern as `Lists.tsx`/`Settings.tsx`), or pass `[]` if lists aren't loaded.

`upsert` helper (add to the file):

```ts
function upsertCrate(list: CrateDefinition[], crate: CrateDefinition): CrateDefinition[] {
  const idx = list.findIndex((c) => c.id === crate.id);
  if (idx === -1) return [...list, crate];
  const next = [...list];
  next[idx] = crate;
  return next;
}
```

Keep `handlePick`, `handlePromote`, `handleAcceptFriendRec`, `handleDismissFriendRec`, `DetailPanel` wiring. For friend-crate behaviors, detect via `crate.source === "friends"` instead of `mode === "from_friends"`. For promote-on-discover, treat any crate as promotable (pass `onFavorite={handlePromote}`) since list-type is now just a filter; promoting always moves an item to favorite.

The `handlePick`/`recordPick` call still sends `{ item_id, mode }` — pass `mode: crate.id` so picks are attributed to the crate (the picks API stores `mode` as a free string; History will show the crate id — acceptable, and a follow-up could map id→name).

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: errors remaining only in `Settings.tsx` and `Lists.tsx` (fixed in Tasks 9-10). `Crates.tsx` clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Crates.tsx
git commit -m "feat: render user-defined crates on the Crates page"
```

---

## Task 9: Library "Save as crate" button

**Files:**
- Modify: `src/pages/Lists.tsx`

**Interfaces:**
- Consumes: `crateDefs`, `saveCrateDefs` (DataCache); `CrateEditorModal`, `makeEmptyCrate` (Task 7); local `rules`, `matchMode`, `availableGenres` (already in `Lists.tsx`).

- [ ] **Step 1: Add the button + modal**

In `src/pages/Lists.tsx`:
- Pull `crateDefs`, `saveCrateDefs` from `useDataCache()`.
- Add `const [editing, setEditing] = useState<CrateDefinition | null>(null);`.
- Add a "SAVE AS CRATE" button in the controls row (next to `DUPLICATES`, same styling), enabled when `rules.length > 0` (still allow empty — a crate with no filters is valid; keep it always enabled).
- On click: `setEditing({ ...makeEmptyCrate(crateDefs.length), filters: { rules, matchMode } })`.
- Render the modal when `editing`:

```tsx
{editing && (
  <CrateEditorModal
    initial={editing}
    availableGenres={availableGenres}
    onSave={(crate) => { saveCrateDefs([...crateDefs, crate]); setEditing(null); }}
    onClose={() => setEditing(null)}
  />
)}
```

(no `onDelete` — this is always a create flow).

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: errors remaining only in `Settings.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Lists.tsx
git commit -m "feat: create a crate from the Library filters"
```

---

## Task 10: Settings cleanup

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Remove global tuning and Right Now contexts**

In `src/pages/Settings.tsx`:
- Remove the "Suggestions per section" cards picker (per-crate `count` replaces it).
- Remove the "Selection Tuning" section (Cooldown / Variety / Discovery sliders) and their state/handlers (`cooldownIdx`, `varietyIdx`, `discoveryIdx`, `handleAlgorithmSave`, the `*_STOPS`/`*_LABELS` consts, `nearestIdx`).
- Remove the "Right now contexts" section and all its state (`localContexts`, `expandedKey`, `confirmDelete`, `previewContext`, `addContext`, `saveContexts`, `updateContext`, `deleteContext`), the `GenrePicker`/`ContextAlbumsModal` usage, and the sticky save bar.
- Keep the profile dropdown / account chrome and the `Layout`. If the page would be near-empty, add a short explanatory line: "Crate selection settings now live on each crate — edit a crate from the Crates tab." Keep `sliderStyle` only if still used (it isn't after removal — delete it).

> Leave `GenrePicker.tsx` and `ContextAlbumsModal.tsx` files in place (unused now, no harm); removing them is out of scope.

- [ ] **Step 2: Typecheck — full green build**

Run: `npm run build`
Expected: **no TypeScript errors anywhere.**

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "refactor: remove global tuning from Settings (now per-crate)"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the app**

Run: `npm run dev` (vercel dev — serves client + API). Log in with Spotify.

- [ ] **Step 2: Verify seeding**

On first load of the Crates tab, confirm starter crates appear: Favorites, Discover, Surprise Me, one per previously-used Right Now context, and From Friends. Confirm each shows albums (Surprise/AI may take a moment).

- [ ] **Step 3: Verify create-from-Library**

Go to Library, apply a genre + year filter, click "SAVE AS CRATE", name it, choose Weighted, save. Return to Crates — the new crate appears and shows matching albums. Refresh it (↻) and confirm picks change.

- [ ] **Step 4: Verify edit + each strategy**

Edit a crate → switch to RANDOM, save, refresh → picks are random from the filtered pool. Switch to AI · LIBRARY with a prompt → picks reflect the vibe. Switch to AI · NEW → suggests albums not in your library. Verify AI failure falls back gracefully (e.g. temporarily unset `ANTHROPIC_API_KEY` and confirm picks still appear).

- [ ] **Step 5: Verify delete + persistence**

Delete a crate from the modal; confirm it disappears and stays gone after a full page reload (persisted in `user_config.crates`).

- [ ] **Step 6: Verify Settings**

Confirm Settings no longer shows tuning sliders / Right Now contexts and the app has no console errors.

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), shared filter engine (Task 2), recently-added weighting (Task 3), four strategies + friends (Task 4), dashboard rewrite + seeding/migration (Task 5), client wiring (Task 6), editor modal (Task 7), Crates page (Task 8), Library "save as crate" (Task 9), Settings cleanup (Task 10), verification (Task 11). All spec sections map to tasks.
- **Known mid-plan build state:** Tasks 6-9 leave downstream page type errors that are resolved by Task 10; the build is fully green at Task 10 Step 2. Implementers preferring per-commit green builds can batch Tasks 6-10.
- **History `mode` field:** picks now record `mode = crate.id`. The History page displays `mode` as a string; crate-id display is acceptable for this scope. A future enhancement could resolve id→name.
```

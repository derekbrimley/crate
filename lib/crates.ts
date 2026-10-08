import { applyFilters, ruleIsComplete, MULTI_SEP, type FilterRule, type PickStat } from "./filters";
import type { SelectionConfig } from "./selection";
import type { Item } from "./types";

export type Weighting = SelectionConfig;

export interface CrateFilters {
  rules: FilterRule[];
  matchMode: "AND" | "OR";
}

/**
 * A crate's contents are
 *   (library items matching its filters) + (items added by hand)
 *   − (items left out by hand).
 * Filters let nothing in until they have a rule, so a crate with no rules is a
 * hand-picked list, and the "Everything" rule takes the whole library.
 * Added-by-hand items always appear, recommendations included.
 */
export interface CrateDefinition {
  id: string;
  name: string;
  position: number;
  filters: CrateFilters;
  /** Whether filter matches may include recommendations, not only favorites. */
  include_recommendations: boolean;
  include_ids: number[];
  exclude_ids: number[];
  /** Show Claude's suggestions for new albums that fit the crate. */
  ai_suggestions: boolean;
}

/** The one weighting every crate is ranked with. */
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

// ── Contents ──────────────────────────────────────────────────────────────────

function matchesFilters(crate: CrateDefinition, items: Item[], pickStats: Map<number, PickStat>): Item[] {
  if (!crate.filters.rules.some(ruleIsComplete)) return [];
  const base = crate.include_recommendations ? items : items.filter((i) => i.list_type === "favorite");
  return applyFilters(base, crate.filters.rules, crate.filters.matchMode, pickStats);
}

/** Every library item in the crate: filter matches not left out, then hand-added ones. */
export function cratePool(crate: CrateDefinition, items: Item[], pickStats: Map<number, PickStat>): Item[] {
  const excluded = new Set(crate.exclude_ids);
  const matched = matchesFilters(crate, items, pickStats).filter((i) => !excluded.has(i.id));
  const seen = new Set(matched.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const added = crate.include_ids
    .map((id) => byId.get(id))
    .filter((i): i is Item => i !== undefined && !seen.has(i.id));
  return [...matched, ...added];
}

export type Membership = "filter" | "hand" | "excluded" | "none";

/** How (or whether) an item is in a crate. */
export function crateMembership(crate: CrateDefinition, item: Item, pickStats: Map<number, PickStat>): Membership {
  if (crate.include_ids.includes(item.id)) return "hand";
  if (crate.exclude_ids.includes(item.id)) return "excluded";
  return matchesFilters(crate, [item], pickStats).length > 0 ? "filter" : "none";
}

/**
 * Flips an item in or out of a crate: adds it by hand, takes a hand-added one
 * back out, leaves out a filter match, or puts a left-out one back.
 */
export function toggleMembership(crate: CrateDefinition, item: Item, pickStats: Map<number, PickStat>): CrateDefinition {
  const without = (ids: number[]) => ids.filter((id) => id !== item.id);
  switch (crateMembership(crate, item, pickStats)) {
    case "hand":
      return { ...crate, include_ids: without(crate.include_ids) };
    case "excluded":
      return { ...crate, exclude_ids: without(crate.exclude_ids) };
    case "filter":
      return { ...crate, exclude_ids: [...crate.exclude_ids, item.id] };
    case "none":
      return { ...crate, include_ids: [...crate.include_ids, item.id] };
  }
}

// ── Seeding and conversion ────────────────────────────────────────────────────

let seq = 0;
export function makeCrateId(): string {
  seq += 1;
  return `crate_${Date.now()}_${seq}_${Math.floor(Math.random() * 1e6)}`;
}

export function makeEmptyCrate(position: number): CrateDefinition {
  return {
    id: makeCrateId(),
    name: "",
    position,
    filters: { rules: [], matchMode: "AND" },
    include_recommendations: false,
    include_ids: [],
    exclude_ids: [],
    ai_suggestions: false,
  };
}

/** The rule that matches every record. */
export function everythingRule(id = "r-all"): FilterRule {
  return { id, field: "all", operator: "is", value: "" };
}

const SEED_GENRE_CRATES: { name: string; genres: string[] }[] = [
  { name: "Morning", genres: ["indie pop", "folk", "acoustic", "singer-songwriter", "jazz", "soul"] },
  { name: "Deep Work", genres: ["ambient", "electronic", "post-rock", "classical", "instrumental", "lo-fi", "neo-classical"] },
  { name: "Cooking", genres: ["soul", "r&b", "jazz", "funk", "bossa nova", "latin", "indie pop"] },
  { name: "Hosting", genres: ["pop", "indie pop", "soul", "r&b", "funk", "dance", "latin"] },
  { name: "Winding Down", genres: ["ambient", "folk", "acoustic", "indie folk", "classical", "lo-fi", "neo-soul"] },
];

/** First-run crates: all favorites, a few genre-based moods, and Claude's picks. */
export function seedCrates(): CrateDefinition[] {
  const crates: CrateDefinition[] = [
    { ...makeEmptyCrate(0), name: "Favorites", filters: { rules: [everythingRule()], matchMode: "AND" } },
  ];
  for (const seed of SEED_GENRE_CRATES) {
    crates.push({
      ...makeEmptyCrate(crates.length),
      name: seed.name,
      filters: {
        rules: [{ id: "r1", field: "genre", operator: "is_any_of", value: seed.genres.join(MULTI_SEP) }],
        matchMode: "AND",
      },
      include_recommendations: true,
    });
  }
  crates.push({ ...makeEmptyCrate(crates.length), name: "Surprise Me", ai_suggestions: true });
  return crates;
}

function numberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : [];
}

/**
 * Brings stored crates to the current shape. Older crates carried a source,
 * a count and a pick strategy (weighted, random or AI); those go away:
 * - the friends crate is dropped (friend recs live on Discover now);
 * - a "List is favorite" rule becomes include_recommendations: false;
 * - a crate whose only rule was "List is recommendation" is dropped, since
 *   Discover is that list; alongside other rules it just becomes
 *   include_recommendations: true;
 * - old crates with no rules took the whole library, so they get the
 *   "Everything" rule (no rules now means hand-picked only);
 * - AI "new music" and hybrid crates keep Claude's suggestions turned on;
 *   an AI new-music crate never drew from the library, so it gets no rule.
 * Idempotent: current-shape crates come back unchanged, and `changed` says
 * whether anything needs saving.
 */
export function normalizeCrates(raw: unknown): { crates: CrateDefinition[]; changed: boolean } {
  if (!Array.isArray(raw)) return { crates: [], changed: raw !== undefined };
  const out: CrateDefinition[] = [];

  const sorted = [...raw]
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

  for (const c of sorted) {
    if (c.source === "friends") continue;
    const isOld = "strategy" in c;
    const strategy = (c.strategy as { type?: string } | undefined)?.type;

    const filters = (c.filters ?? {}) as Partial<CrateFilters>;
    const allRules = Array.isArray(filters.rules) ? filters.rules : [];
    const isList = (r: FilterRule, v: string) => r.field === "list" && r.value === v;
    const hasFavRule = allRules.some((r) => isList(r, "favorite"));
    const hasRecRule = allRules.some((r) => isList(r, "recommendation"));
    let rules = allRules.filter((r) => r.field !== "list");
    const hasActiveRule = rules.some(ruleIsComplete);
    if (isOld && hasRecRule && !hasActiveRule) continue;
    if (isOld && !hasActiveRule && strategy !== "ai_new") rules = [everythingRule()];

    out.push({
      id: typeof c.id === "string" ? c.id : makeCrateId(),
      name: typeof c.name === "string" ? c.name : "",
      position: out.length,
      filters: { rules, matchMode: filters.matchMode === "OR" ? "OR" : "AND" },
      include_recommendations:
        typeof c.include_recommendations === "boolean" ? c.include_recommendations : !hasFavRule,
      include_ids: numberArray(c.include_ids),
      exclude_ids: numberArray(c.exclude_ids),
      ai_suggestions:
        typeof c.ai_suggestions === "boolean" ? c.ai_suggestions : strategy === "ai_new" || strategy === "hybrid",
    });
  }

  return { crates: out, changed: canonical(out) !== canonical(sorted) };
}

// JSON with object keys sorted. Stored crates come back from a JSONB column,
// which doesn't keep key order, so plain JSON.stringify would see a change on
// every load.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

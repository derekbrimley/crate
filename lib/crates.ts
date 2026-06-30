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
  | { type: "ai_new"; prompt?: string }
  | { type: "hybrid"; prompt?: string; weighting: Weighting };

// Strategies that hit Claude (and possibly Spotify) and are slow enough to
// defer off the initial dashboard load. ai_pool only calls Claude when it has
// a prompt; without one it's just a weighted pick from the pool.
export function isSlowStrategy(strategy: CrateStrategy): boolean {
  if (strategy.type === "ai_new" || strategy.type === "hybrid") return true;
  if (strategy.type === "ai_pool") return Boolean(strategy.prompt && strategy.prompt.trim());
  return false;
}

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

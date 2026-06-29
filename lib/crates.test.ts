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

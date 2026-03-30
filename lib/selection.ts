import type { Item, LastPickInfo } from "./types";

const SECONDS_PER_DAY = 86400;

export interface SelectionConfig {
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  weight_low: number;
  weight_medium: number;
  weight_high: number;
  weight_never_picked_bonus: number;
  randomness_factor: number;
}

function daysAgo(unixTimestamp: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return (nowSeconds - unixTimestamp) / SECONDS_PER_DAY;
}

function weightedSample<T>(pool: T[], weights: number[], count: number): T[] {
  if (pool.length === 0) return [];
  const result: T[] = [];
  const remaining = [...pool];
  const remainingWeights = [...weights];

  const actualCount = Math.min(count, pool.length);
  for (let i = 0; i < actualCount; i++) {
    const totalWeight = remainingWeights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      result.push(remaining[idx]);
      remaining.splice(idx, 1);
      remainingWeights.splice(idx, 1);
    } else {
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < remainingWeights.length; idx++) {
        r -= remainingWeights[idx];
        if (r <= 0) break;
      }
      idx = Math.min(idx, remaining.length - 1);
      result.push(remaining[idx]);
      remaining.splice(idx, 1);
      remainingWeights.splice(idx, 1);
    }
  }
  return result;
}

export function selectAlbums(
  pool: Item[],
  count: number,
  picks: LastPickInfo[],
  config: SelectionConfig
): Item[] {
  const {
    cooldown_days,
    weight_recent_days,
    weight_medium_days,
    weight_low,
    weight_medium,
    weight_high,
    weight_never_picked_bonus,
    randomness_factor,
  } = config;

  const pickMap = new Map<number, LastPickInfo>();
  for (const p of picks) pickMap.set(p.item_id, p);

  const weights: number[] = [];
  const eligiblePool: Item[] = [];

  for (const item of pool) {
    const pickInfo = pickMap.get(item.id);
    const neverPicked = !pickInfo;

    let daysSince = Infinity;
    if (pickInfo) {
      daysSince = daysAgo(pickInfo.picked_at);
    }

    let weight: number;
    if (daysSince < cooldown_days) {
      weight = 0;
    } else if (daysSince < weight_recent_days) {
      weight = weight_low;
    } else if (daysSince < weight_medium_days) {
      weight = weight_medium;
    } else {
      weight = weight_high;
    }

    if (neverPicked) {
      weight += weight_never_picked_bonus;
    }

    if (weight > 0) {
      const adjustedWeight = weight * Math.pow(Math.random(), 1 / randomness_factor);
      eligiblePool.push(item);
      weights.push(adjustedWeight);
    }
  }

  return weightedSample(eligiblePool, weights, count);
}

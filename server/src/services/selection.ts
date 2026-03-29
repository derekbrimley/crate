import { Item, LastPickInfo, getConfig } from "../db/queries";

const SECONDS_PER_DAY = 86400;

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
  userId: number,
  pool: Item[],
  count: number,
  picks: LastPickInfo[]
): Item[] {
  const cooldownDays = getConfig<number>(userId, "cooldown_days");
  const weightRecentDays = getConfig<number>(userId, "weight_recent_days");
  const weightMediumDays = getConfig<number>(userId, "weight_medium_days");
  const weightLow = getConfig<number>(userId, "weight_low");
  const weightMedium = getConfig<number>(userId, "weight_medium");
  const weightHigh = getConfig<number>(userId, "weight_high");
  const weightNeverPickedBonus = getConfig<number>(userId, "weight_never_picked_bonus");
  const randomnessFactor = getConfig<number>(userId, "randomness_factor");

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
    if (daysSince < cooldownDays) {
      weight = 0;
    } else if (daysSince < weightRecentDays) {
      weight = weightLow;
    } else if (daysSince < weightMediumDays) {
      weight = weightMedium;
    } else {
      weight = weightHigh;
    }

    if (neverPicked) {
      weight += weightNeverPickedBonus;
    }

    if (weight > 0) {
      const adjustedWeight = weight * Math.pow(Math.random(), 1 / randomnessFactor);
      eligiblePool.push(item);
      weights.push(adjustedWeight);
    }
  }

  return weightedSample(eligiblePool, weights, count);
}

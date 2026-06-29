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
        return randomSample(allItems, crate.count);
      }
    }

    default:
      return randomSample(pool, crate.count);
  }
}

import type { Item } from "../types";

/**
 * Lays a frozen order over the current pool. Items that have left the pool are
 * skipped, and items added since the order was made go at the end of the
 * playable list.
 */
export function applyRankOrder(
  order: { ranked: number[]; resting: number[] },
  pool: Item[]
): { ranked: Item[]; resting: Item[] } {
  const byId = new Map(pool.map((i) => [i.id, i]));
  const placed = new Set<number>();
  const take = (ids: number[]) =>
    ids.flatMap((id) => {
      const item = byId.get(id);
      if (!item || placed.has(id)) return [];
      placed.add(id);
      return [item];
    });
  const ranked = take(order.ranked);
  const resting = take(order.resting);
  const added = pool.filter((i) => !placed.has(i.id));
  return { ranked: [...ranked, ...added], resting };
}

import type { Item } from "../types";

/**
 * Library items matching a search: every word of the query must appear in the
 * title or artist (any order, any case). Title matches come first.
 */
export function matchLibrary(items: Item[], query: string): Item[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits = items.filter((i) => {
    const haystack = `${i.title} ${i.creator}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  const inTitle = (i: Item) => words.every((w) => i.title.toLowerCase().includes(w));
  return [...hits.filter(inTitle), ...hits.filter((i) => !inTitle(i))];
}

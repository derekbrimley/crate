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

import type { Item } from "./types";

export type FieldKey = "year" | "genre" | "artist" | "list" | "plays" | "last_played";

export interface FilterRule {
  id: string;
  field: FieldKey;
  operator: string;
  value: string;
  value2?: string;
}

export interface PickStat {
  pickCount: number;
  lastPickedTs: number | null;
}

// Multi-value genre rules ("is any of") store their genres joined by this
// separator so the rule stays a flat string. Pipe is safe — genres don't use it.
export const MULTI_SEP = "|";

interface FieldDef {
  label: string;
  operators: { key: string; label: string }[];
  valueType: "number" | "text" | "genre" | "list";
  needsValue2?: (op: string) => boolean;
  // Operators that need no value at all (e.g. "never played").
  needsValue?: (op: string) => boolean;
}

export const FIELD_DEFS: Record<FieldKey, FieldDef> = {
  year: {
    label: "Year",
    operators: [
      { key: "is", label: "is" },
      { key: "between", label: "is between" },
      { key: "before", label: "before" },
      { key: "after", label: "after" },
    ],
    valueType: "number",
    needsValue2: (op) => op === "between",
  },
  genre: {
    label: "Genre",
    operators: [
      { key: "is", label: "is" },
      { key: "is_not", label: "is not" },
      { key: "is_any_of", label: "is any of" },
    ],
    valueType: "genre",
  },
  artist: {
    label: "Artist",
    operators: [
      { key: "is", label: "is" },
      { key: "contains", label: "contains" },
    ],
    valueType: "text",
  },
  list: {
    label: "List",
    operators: [{ key: "is", label: "is" }],
    valueType: "list",
  },
  plays: {
    label: "Plays",
    operators: [
      { key: "gte", label: "≥" },
      { key: "lte", label: "≤" },
      { key: "is", label: "is" },
    ],
    valueType: "number",
  },
  last_played: {
    label: "Last played",
    operators: [
      { key: "more_than_days_ago", label: "more than (days) ago" },
      { key: "within_days", label: "within (days)" },
      { key: "never", label: "never played" },
    ],
    valueType: "number",
    needsValue: (op) => op !== "never",
  },
};

function parseMeta(item: Item): Record<string, unknown> {
  const m = item.metadata;
  if (!m) return {};
  if (typeof m === "string") {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return m;
}

export function getItemYear(item: Item): number | null {
  const rd = parseMeta(item).release_date as string | undefined;
  if (!rd || rd.length < 4) return null;
  const y = parseInt(rd.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function getItemGenres(item: Item): string[] {
  const g = parseMeta(item).genres;
  return Array.isArray(g) ? (g as string[]) : [];
}

export function makeRuleId(seed: number): string {
  return `rule-${seed}`;
}

function ruleIsComplete(rule: FilterRule): boolean {
  const def = FIELD_DEFS[rule.field];
  const valueOptional = def.needsValue ? !def.needsValue(rule.operator) : false;
  if (!valueOptional && rule.value.trim() === "") return false;
  if (def.needsValue2?.(rule.operator) && (rule.value2 ?? "").trim() === "") {
    return false;
  }
  return true;
}

function evaluate(item: Item, rule: FilterRule, pickStats: Map<number, PickStat>): boolean {
  switch (rule.field) {
    case "year": {
      const y = getItemYear(item);
      if (y === null) return false;
      const v = parseInt(rule.value, 10);
      if (Number.isNaN(v)) return false;
      if (rule.operator === "is") return y === v;
      if (rule.operator === "before") return y < v;
      if (rule.operator === "after") return y > v;
      if (rule.operator === "between") {
        const v2 = parseInt(rule.value2 ?? "", 10);
        if (Number.isNaN(v2)) return false;
        const lo = Math.min(v, v2);
        const hi = Math.max(v, v2);
        return y >= lo && y <= hi;
      }
      return false;
    }
    case "genre": {
      const genres = getItemGenres(item).map((g) => g.toLowerCase());
      if (rule.operator === "is_any_of") {
        const targets = rule.value
          .split(MULTI_SEP)
          .map((g) => g.trim().toLowerCase())
          .filter(Boolean);
        return targets.some((t) => genres.includes(t));
      }
      const target = rule.value.toLowerCase();
      const has = genres.includes(target);
      return rule.operator === "is_not" ? !has : has;
    }
    case "artist": {
      const a = item.creator.toLowerCase();
      const target = rule.value.toLowerCase();
      return rule.operator === "contains" ? a.includes(target) : a === target;
    }
    case "list":
      return item.list_type === rule.value;
    case "plays": {
      const count = pickStats.get(item.id)?.pickCount ?? 0;
      const v = parseInt(rule.value, 10);
      if (rule.operator === "gte") return count >= v;
      if (rule.operator === "lte") return count <= v;
      if (rule.operator === "is") return count === v;
      return false;
    }
    case "last_played": {
      const lastTs = pickStats.get(item.id)?.lastPickedTs ?? null;
      if (rule.operator === "never") return lastTs === null;
      if (lastTs === null) {
        // Never played: counts as "more than ago" (infinitely long), never "within".
        return rule.operator === "more_than_days_ago";
      }
      const days = parseInt(rule.value, 10);
      if (Number.isNaN(days)) return false;
      const daysSince = (Date.now() / 1000 - lastTs) / 86400;
      if (rule.operator === "more_than_days_ago") return daysSince > days;
      if (rule.operator === "within_days") return daysSince <= days;
      return false;
    }
    default:
      return false;
  }
}

export function applyFilters(
  items: Item[],
  rules: FilterRule[],
  matchMode: "AND" | "OR",
  pickStats: Map<number, PickStat>
): Item[] {
  const active = rules.filter(ruleIsComplete);
  if (active.length === 0) return items;
  return items.filter((item) => {
    if (matchMode === "AND") return active.every((r) => evaluate(item, r, pickStats));
    return active.some((r) => evaluate(item, r, pickStats));
  });
}

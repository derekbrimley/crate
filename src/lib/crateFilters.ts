import type { FilterRule } from "../../lib/filters";

// Fold the Library's quick LIST filter (favorite/recommendation) into a crate's
// rule list so a crate saved from the Library reproduces what the user sees.
//
// NOTE: When existing rules use matchMode "OR", appending an AND-style list
// constraint to a flat OR rule set is not perfectly expressible — the list rule
// becomes just another OR term. The dominant case (list filter with no rules, or
// with AND rules) is exact; the OR + list combination is a documented limitation.
export function foldListFilterIntoRules(
  rules: FilterRule[],
  matchMode: "AND" | "OR",
  listFilter: "all" | "favorite" | "recommendation"
): { rules: FilterRule[]; matchMode: "AND" | "OR" } {
  if (listFilter === "all") return { rules, matchMode };

  const alreadyPresent = rules.some(
    (r) => r.field === "list" && r.operator === "is" && r.value === listFilter
  );
  if (alreadyPresent) return { rules, matchMode };

  const listRule: FilterRule = {
    id: `rule-list-${Date.now()}`,
    field: "list",
    operator: "is",
    value: listFilter,
  };
  return { rules: [...rules, listRule], matchMode };
}

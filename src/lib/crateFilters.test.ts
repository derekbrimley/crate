import { describe, it, expect } from "vitest";
import { foldListFilterIntoRules } from "./crateFilters";
import type { FilterRule } from "../../lib/filters";

describe("foldListFilterIntoRules", () => {
  it("returns rules unchanged when listFilter is 'all'", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "all");
    expect(out.rules).toEqual(rules);
    expect(out.matchMode).toBe("AND");
  });

  it("appends a list rule when listFilter is favorite and no rules exist", () => {
    const out = foldListFilterIntoRules([], "AND", "favorite");
    expect(out.rules).toHaveLength(1);
    expect(out.rules[0]).toMatchObject({ field: "list", operator: "is", value: "favorite" });
    expect(out.matchMode).toBe("AND");
  });

  it("appends a list rule alongside existing AND rules", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "recommendation");
    expect(out.rules).toHaveLength(2);
    expect(out.rules[1]).toMatchObject({ field: "list", operator: "is", value: "recommendation" });
  });

  it("does not duplicate an existing identical list rule", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "list", operator: "is", value: "favorite" }];
    const out = foldListFilterIntoRules(rules, "AND", "favorite");
    expect(out.rules).toHaveLength(1);
  });

  it("generates a unique rule id", () => {
    const rules: FilterRule[] = [{ id: "r1", field: "year", operator: "after", value: "2000" }];
    const out = foldListFilterIntoRules(rules, "AND", "favorite");
    const ids = out.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

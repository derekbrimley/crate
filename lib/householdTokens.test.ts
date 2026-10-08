import { describe, expect, it } from "vitest";
import { HOUSEHOLD_PREFIX, generateHouseholdToken, hashToken, isHouseholdToken, scopeAllows } from "./householdTokens";

describe("household tokens", () => {
  it("generates prefixed, unique tokens", () => {
    const a = generateHouseholdToken();
    const b = generateHouseholdToken();
    expect(a.startsWith(HOUSEHOLD_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(isHouseholdToken(a)).toBe(true);
  });

  it("does not mistake a JWT or a short string for a household token", () => {
    expect(isHouseholdToken("eyJhbGciOiJIUzI1NiJ9.x.y")).toBe(false);
    expect(isHouseholdToken(HOUSEHOLD_PREFIX)).toBe(false);
    expect(isHouseholdToken("")).toBe(false);
  });

  it("hashes deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toHaveLength(64);
  });

  it("never grants edit to a read/play token", () => {
    expect(scopeAllows(["read", "play"], "read")).toBe(true);
    expect(scopeAllows(["read", "play"], "play")).toBe(true);
    expect(scopeAllows(["read", "play"], "edit")).toBe(false);
    expect(scopeAllows(["read"], "play")).toBe(false);
  });
});

// Household tokens are bearer tokens for shared devices, such as the kitchen
// dashboard, that may read crates and start playback but never edit. They are
// recognisable by prefix so a Supabase JWT and a household token can share the
// same Authorization header. Pure helpers only; the DB side is in queries.ts.
import { createHash, randomBytes } from "crypto";

export const HOUSEHOLD_PREFIX = "crate_hh_";

// What a route needs. "edit" is the default and only a signed-in session has it.
export type AuthScope = "read" | "play" | "edit";

export const HOUSEHOLD_SCOPES: AuthScope[] = ["read", "play"];

export function generateHouseholdToken(): string {
  return HOUSEHOLD_PREFIX + randomBytes(24).toString("hex");
}

export function isHouseholdToken(token: string): boolean {
  return token.startsWith(HOUSEHOLD_PREFIX) && token.length > HOUSEHOLD_PREFIX.length + 16;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function scopeAllows(scopes: string[], required: AuthScope): boolean {
  if (required === "edit") return scopes.includes("edit");
  return scopes.includes(required);
}

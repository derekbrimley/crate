import { supabaseAdmin } from "./supabaseAdmin";
import { findHouseholdToken, touchHouseholdToken } from "./queries";
import { hashToken, isHouseholdToken, scopeAllows, type AuthScope } from "./householdTokens";
import type { User } from "./types";

// Resolves the Authorization header to a public.users row.
//
// Two kinds of bearer token are accepted:
// - a Supabase session JWT (the web app): full access, every scope;
// - a household token (`crate_hh_…`, see householdTokens.ts): read and play
//   only. Routes that edit anything keep the default scope, "edit", so a
//   household token is rejected there without any per-route code.
export async function getAuthenticatedUser(
  authHeader: string | undefined,
  scope: AuthScope = "edit"
): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  if (isHouseholdToken(token)) {
    const row = await findHouseholdToken(hashToken(token));
    if (!row || !scopeAllows(row.scopes, scope)) return null;
    void touchHouseholdToken(row.id);
    return row.user;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;

  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("supabase_uid", user.id)
    .single();

  return (data as User) ?? null;
}

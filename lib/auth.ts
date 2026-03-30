import { supabaseAdmin } from "./supabaseAdmin";
import type { User } from "./types";

export async function getAuthenticatedUser(
  authHeader: string | undefined
): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

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

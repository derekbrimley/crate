import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { createHouseholdToken, getAllConfig, listHouseholdTokens, revokeHouseholdToken, setConfig } from "../../lib/queries";
import { HOUSEHOLD_SCOPES, generateHouseholdToken, hashToken } from "../../lib/householdTokens";

// GET    /api/config                           user config (household tokens may read it)
// PATCH  /api/config                           update config
// GET    /api/config?household_tokens=1        list household tokens (name, dates; never the secret)
// POST   /api/config?household_tokens=1        { name } -> { token, ... }  shown once
// DELETE /api/config?household_tokens=1&id=    revoke
//
// Token management lives here rather than in its own file to stay under the
// Hobby plan's function limit.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isTokenRoute = req.query.household_tokens != null;
  const scope = req.method === "GET" && !isTokenRoute ? "read" : "edit";
  const user = await getAuthenticatedUser(req.headers.authorization, scope);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (isTokenRoute) {
    if (req.method === "GET") {
      return res.json({ tokens: await listHouseholdTokens(user.id) });
    }
    if (req.method === "POST") {
      const { name } = (req.body ?? {}) as { name?: string };
      const label = typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "Kitchen";
      const token = generateHouseholdToken();
      const row = await createHouseholdToken(user.id, label, hashToken(token), HOUSEHOLD_SCOPES);
      return res.status(201).json({ token, id: row.id, name: row.name, scopes: row.scopes, created_at: row.created_at });
    }
    if (req.method === "DELETE") {
      const id = parseInt((req.query.id as string) || "", 10);
      if (isNaN(id)) return res.status(400).json({ error: "id is required" });
      await revokeHouseholdToken(user.id, id);
      return res.status(204).end();
    }
    return res.status(405).end();
  }

  if (req.method === "GET") {
    const config = await getAllConfig(user.id);
    return res.json({ config });
  }

  if (req.method === "PATCH") {
    const updates = req.body as Record<string, unknown>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) => setConfig(user.id, key, value))
    );
    const config = await getAllConfig(user.id);
    return res.json({ config });
  }

  res.status(405).end();
}

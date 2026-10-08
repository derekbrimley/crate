import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getLastPicksForUser, setConfig } from "../../lib/queries";
import { normalizeCrates, seedCrates } from "../../lib/crates";

/**
 * GET /api/picks/dashboard — the user's crate definitions and per-item play
 * stats. The client ranks crates and Discover from these plus the library.
 *
 * Crates are seeded on first load and converted to the current shape when an
 * older one is found; either way the result is saved so later loads are stable.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const [config, recentPicks] = await Promise.all([
    getAllConfig(user.id),
    getLastPicksForUser(user.id),
  ]);

  let { crates, changed } = normalizeCrates(config.crates);
  if (config.crates === undefined) {
    crates = seedCrates();
    changed = true;
  }
  if (changed) await setConfig(user.id, "crates", crates);

  res.json({ _config: { ...config, crates }, _picks: recentPicks });
}

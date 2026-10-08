import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getItems, getLastPicksForUser, setConfig, deleteConfigKeys } from "../../lib/queries";
import { normalizeCrates, seedCrates, cratePool } from "../../lib/crates";
import { suggestionItems } from "../../lib/suggestions";
import type { PickStat } from "../../lib/filters";
import type { User } from "../../lib/types";

/**
 * Settings from the old shelf dashboard (cards per mode, global weighting,
 * "For right now" contexts). Nothing reads them any more; they're deleted
 * the first time they're seen.
 */
const LEGACY_CONFIG_KEYS = [
  "dashboard_modes", "cards_per_mode", "cooldown_days", "weight_recent_days", "weight_medium_days",
  "weight_low", "weight_medium", "weight_high", "weight_never_picked_bonus", "recently_added_days",
  "recently_added_bonus", "randomness_factor", "contexts", "right_now_contexts",
];

// Claude plus a handful of Spotify searches can take several seconds.
export const config = { maxDuration: 30 };

/**
 * GET /api/crates — the user's crate definitions and per-item play
 * stats. The client ranks crates and Discover from these plus the library.
 *
 * Crates are seeded on first load and converted to the current shape when an
 * older one is found; either way the result is saved so later loads are stable.
 *
 * GET /api/crates?suggest=<crateId>|discover — Claude's suggestions
 * for new albums: for a crate, matching its records (and named after it); for
 * Discover, matching the user's favorites.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const suggest = typeof req.query.suggest === "string" ? req.query.suggest : null;
  if (suggest) return sendSuggestions(user, suggest, res);

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

  const legacy = LEGACY_CONFIG_KEYS.filter((k) => k in config);
  if (legacy.length > 0) {
    await deleteConfigKeys(user.id, legacy);
    for (const k of legacy) delete config[k];
  }

  res.json({ _config: { ...config, crates }, _picks: recentPicks });
}

async function sendSuggestions(user: User, target: string, res: VercelResponse) {
  const [config, items, picks] = await Promise.all([
    getAllConfig(user.id),
    getItems(user.id),
    getLastPicksForUser(user.id),
  ]);
  const favorites = items.filter((i) => i.list_type === "favorite");
  const albums = (xs: typeof items) => xs.filter((i) => i.media_type !== "playlist");

  let seed = albums(favorites);
  let theme: string | undefined;

  if (target !== "discover") {
    const crate = normalizeCrates(config.crates).crates.find((c) => c.id === target);
    if (!crate) return res.status(404).json({ error: "Crate not found" });
    const stats = new Map<number, PickStat>(
      picks.map((p) => [p.item_id, { pickCount: Number(p.pick_count), lastPickedTs: p.picked_at }])
    );
    const pool = albums(cratePool(crate, items, stats));
    // A crate of only playlists (or an empty one) falls back to the user's taste overall.
    if (pool.length > 0) seed = pool;
    theme = crate.name;
  }
  if (seed.length === 0) seed = albums(items);

  try {
    const suggestions = await suggestionItems(user.id, seed, items, theme);
    return res.json({ suggestions });
  } catch (err) {
    console.error("Suggestions failed:", err);
    return res.status(502).json({ error: "Couldn't get suggestions" });
  }
}

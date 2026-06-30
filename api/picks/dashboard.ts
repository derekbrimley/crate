import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getItems, getLastPicksForUser, getPendingFriendRecommendations, setConfig } from "../../lib/queries";
import { runCrate, type CrateEngineDeps } from "../../lib/crateEngine";
import { seedCratesFromConfig, isSlowStrategy, type CrateDefinition, DEFAULT_WEIGHTING } from "../../lib/crates";
import { getPoolSuggestions, getSurpriseSuggestion } from "../../lib/claude";
import { searchAlbums, getBestImageUrl } from "../../lib/spotify";
import type { SelectionConfig } from "../../lib/selection";
import type { Item } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const requestedCrateId = (req.query.crateId as string) || null;

  const [config, allItems, recentPicks] = await Promise.all([
    getAllConfig(user.id),
    getItems(user.id),
    getLastPicksForUser(user.id),
  ]);

  // Seed crates on first load, persist so subsequent loads are stable.
  let crates = config.crates as CrateDefinition[] | undefined;
  if (!crates || !Array.isArray(crates) || crates.length === 0) {
    crates = seedCratesFromConfig(config);
    await setConfig(user.id, "crates", crates);
  }

  crates = [...crates].sort((a, b) => a.position - b.position);

  const existingIds = new Set(allItems.map((i) => i.external_id));

  // Spotify IDs aren't enough to dedupe: the same album shows up under multiple
  // IDs (remasters, deluxe/regional editions). Also key on normalized
  // title+artist so an album already owned under a different release ID can't be
  // re-suggested. Strip parentheticals like "(Deluxe Edition)" / "(Remastered)".
  const normKey = (title: string, artist: string) => {
    const clean = (s: string) =>
      s
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, "") // drop (...) and [...]
        .replace(/[^a-z0-9]/g, "")            // drop spaces/punctuation
        .trim();
    return `${clean(title)}|${clean(artist)}`;
  };
  const existingKeys = new Set(allItems.map((i) => normKey(i.title, i.creator)));

  const deps: CrateEngineDeps = {
    aiPoolPick: (prompt, pool, count) =>
      getPoolSuggestions(prompt, pool, count, recentPicks, /* weighting */ poolSelectionConfig(crates!, pool)),
    aiNewPick: async (prompt, library, count) => {
      const favorites = library.filter((i) => i.list_type === "favorite");
      const seed = favorites.length > 0 ? favorites : library;
      const suggestions = await getSurpriseSuggestion(seed, library, prompt);
      const shuffled = [...suggestions].sort(() => Math.random() - 0.5);
      const searchResults = await Promise.all(
        shuffled.map(({ title, artist }) => searchAlbums(`${title} ${artist}`, 5).catch(() => []))
      );
      const picks: Item[] = [];
      const chosenKeys = new Set<string>(); // avoid duplicates within this batch
      for (let i = 0; i < shuffled.length && picks.length < count; i++) {
        const match = searchResults[i].find((r) => {
          if (existingIds.has(r.id)) return false;
          const key = normKey(r.name, r.artists[0]?.name || shuffled[i].artist);
          return !existingKeys.has(key) && !chosenKeys.has(key);
        });
        if (match) {
          chosenKeys.add(normKey(match.name, match.artists[0]?.name || shuffled[i].artist));
          picks.push({
            id: 0, user_id: user.id, media_type: "album", list_type: "recommendation",
            title: match.name, creator: match.artists[0]?.name || shuffled[i].artist,
            image_url: getBestImageUrl(match.images), external_id: match.id,
            external_uri: match.uri, external_url: match.external_urls.spotify,
            added_at: Date.now(), metadata: { _ai_suggested: true },
          });
        }
      }
      if (picks.length === 0) throw new Error("no ai_new matches");
      return picks;
    },
    friendPicks: async (count) => {
      const recs = await getPendingFriendRecommendations(user.id, count);
      return recs.map((rec) => ({
        id: rec.id, user_id: user.id, media_type: "album", list_type: "recommendation" as const,
        title: rec.title, creator: rec.creator, image_url: rec.image_url,
        external_id: rec.external_id, external_uri: rec.external_uri, external_url: rec.external_url,
        added_at: rec.sent_at,
        metadata: { _friend_rec: true, _rec_id: rec.id, _sender_name: rec.sender_display_name },
      }));
    },
  };

  const cratesToRun = requestedCrateId ? crates.filter((c) => c.id === requestedCrateId) : crates;

  // On the full dashboard load, defer slow (AI) crates: they hit Claude + Spotify
  // and would block the whole response (~5s). The client lazy-loads each deferred
  // crate via GET /picks/dashboard?crateId=... A single-crate request always runs
  // fully, so the lazy-load path still works.
  const isFullLoad = !requestedCrateId;

  const results = await Promise.all(
    cratesToRun.map(async (c) => {
      if (isFullLoad && isSlowStrategy(c.strategy)) {
        return { id: c.id, items: [] as Item[], deferred: true };
      }
      return { id: c.id, items: await runCrate(c, allItems, recentPicks, deps) };
    })
  );

  res.json({ crates: results, _config: config, _picks: recentPicks });
}

// Pick a reasonable weighting for ai_pool fallback: use the crate's own weighting if weighted,
// otherwise neutral defaults.
function poolSelectionConfig(_crates: CrateDefinition[], _pool: Item[]): SelectionConfig {
  return DEFAULT_WEIGHTING;
}

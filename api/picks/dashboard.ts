import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getItems, getLastPicksForUser } from "../../lib/queries";
import { selectAlbums, type SelectionConfig } from "../../lib/selection";
import { getContextSuggestions, getSurpriseSuggestion } from "../../lib/claude";
import { searchAlbums, getBestImageUrl } from "../../lib/spotify";
import type { Item, RightNowContext } from "../../lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const requestedMode = (req.query.mode as string) || null;
  const rawContext = (req.query.context as string) || null;

  const [config, allItems, recentPicks] = await Promise.all([
    getAllConfig(user.id),
    getItems(user.id),
    getLastPicksForUser(user.id),
  ]);

  const cardsPerMode = config.cards_per_mode as number;
  const dashboardModes = config.dashboard_modes as string[];
  const rightNowContexts = config.right_now_contexts as RightNowContext[] | undefined;

  // Resolve "auto" to the user's first configured context
  const context = rawContext === "auto"
    ? (rightNowContexts?.[0]?.key ?? (config.contexts as string[])?.[0] ?? null)
    : rawContext;

  const selectionConfig: SelectionConfig = {
    cooldown_days: config.cooldown_days as number,
    weight_recent_days: config.weight_recent_days as number,
    weight_medium_days: config.weight_medium_days as number,
    weight_low: config.weight_low as number,
    weight_medium: config.weight_medium as number,
    weight_high: config.weight_high as number,
    weight_never_picked_bonus: config.weight_never_picked_bonus as number,
    randomness_factor: config.randomness_factor as number,
  };

  const favorites = allItems.filter((i) => i.list_type === "favorite");
  const recommendations = allItems.filter((i) => i.list_type === "recommendation");

  // When a specific mode is requested, only run that mode
  const modesToRun = requestedMode && dashboardModes.includes(requestedMode)
    ? [requestedMode]
    : dashboardModes;

  const modeEntries = await Promise.all(
    modesToRun.map(async (mode): Promise<[string, Item[]]> => {
      switch (mode) {
        case "favorites":
          return ["favorites", selectAlbums(favorites, cardsPerMode, recentPicks, selectionConfig)];

        case "discover":
          return ["discover", selectAlbums(recommendations, cardsPerMode, [], selectionConfig)];

        case "for_right_now": {
          if (context && allItems.length > 0) {
            const contextProfile = rightNowContexts?.find((c) => c.key === context);
            return ["for_right_now", getContextSuggestions(context, allItems, cardsPerMode, contextProfile, recentPicks, selectionConfig)];
          }
          return ["for_right_now", selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig)];
        }

        case "surprise": {
          const hasEnoughFavorites = favorites.length >= 2;
          const randomPicks = selectAlbums(allItems, hasEnoughFavorites ? cardsPerMode - 1 : cardsPerMode, recentPicks, selectionConfig);

          if (!hasEnoughFavorites) return ["surprise", randomPicks];

          try {
            const suggestions = await getSurpriseSuggestion(favorites);
            const existingIds = new Set(allItems.map((i) => i.external_id));

            // Shuffle so each refresh surfaces a different suggestion
            const shuffled = [...suggestions].sort(() => Math.random() - 0.5);

            // Search all suggestions in parallel, then find first match
            const searchResults = await Promise.all(
              shuffled.map(({ title, artist }) =>
                searchAlbums(`${title} ${artist}`, 5).catch(() => [] as typeof searchResults[number])
              )
            );

            let aiPick: Item | null = null;
            for (let i = 0; i < shuffled.length; i++) {
              const match = searchResults[i].find((r) => !existingIds.has(r.id));
              if (match) {
                const { artist } = shuffled[i];
                aiPick = {
                  id: 0,
                  user_id: user.id,
                  media_type: "album",
                  list_type: "recommendation",
                  title: match.name,
                  creator: match.artists[0]?.name || artist,
                  image_url: getBestImageUrl(match.images),
                  external_id: match.id,
                  external_uri: match.uri,
                  external_url: match.external_urls.spotify,
                  added_at: Date.now(),
                  metadata: { _ai_suggested: true },
                };
                break;
              }
            }

            return ["surprise", aiPick
              ? [...randomPicks, aiPick]
              : selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig)];
          } catch {
            return ["surprise", selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig)];
          }
        }

        default:
          return [mode, []];
      }
    })
  );

  res.json({ ...Object.fromEntries(modeEntries), _config: config });
}

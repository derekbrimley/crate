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

  const context = (req.query.context as string) || null;

  const [config, allItems, recentPicks] = await Promise.all([
    getAllConfig(user.id),
    getItems(user.id),
    getLastPicksForUser(user.id),
  ]);

  const cardsPerMode = config.cards_per_mode as number;
  const dashboardModes = config.dashboard_modes as string[];
  const rightNowContexts = config.right_now_contexts as RightNowContext[] | undefined;

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

  const result: Record<string, Item[]> = {};

  for (const mode of dashboardModes) {
    switch (mode) {
      case "favorites":
        result.favorites = selectAlbums(favorites, cardsPerMode, recentPicks, selectionConfig);
        break;
      case "discover":
        result.discover = selectAlbums(recommendations, cardsPerMode, [], selectionConfig);
        break;
      case "for_right_now":
        if (context && allItems.length > 0) {
          try {
            const contextProfile = rightNowContexts?.find((c) => c.key === context);
            const suggestions = await getContextSuggestions(context, allItems, cardsPerMode, contextProfile);
            result.for_right_now =
              suggestions.length > 0
                ? suggestions
                : selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
          } catch {
            result.for_right_now = selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
          }
        } else {
          result.for_right_now = selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
        }
        break;
      case "surprise": {
        const hasEnoughFavorites = favorites.length >= 2;
        const randomCount = hasEnoughFavorites ? Math.max(0, cardsPerMode - 1) : cardsPerMode;
        const randomPicks = selectAlbums(allItems, randomCount, recentPicks, selectionConfig);

        if (hasEnoughFavorites) {
          try {
            const suggestions = await getSurpriseSuggestion(favorites);
            const existingIds = new Set(allItems.map((i) => i.external_id));
            let aiPick: Item | null = null;

            // Shuffle so each refresh surfaces a different suggestion
            const shuffled = [...suggestions].sort(() => Math.random() - 0.5);
            for (const { title, artist } of shuffled) {
              const searchResults = await searchAlbums(user.id, `${title} ${artist}`, 5);
              const match = searchResults.find((r) => !existingIds.has(r.id));
              if (match) {
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

            result.surprise = aiPick
              ? [...randomPicks, aiPick]
              : selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
          } catch {
            result.surprise = selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
          }
        } else {
          result.surprise = randomPicks;
        }
        break;
      }
    }
  }

  res.json(result);
}

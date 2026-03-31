import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, getItems, getLastPicksForUser } from "../../lib/queries";
import { selectAlbums, type SelectionConfig } from "../../lib/selection";
import { getContextSuggestions } from "../../lib/claude";
import type { Item } from "../../lib/types";

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
            const suggestions = await getContextSuggestions(context, allItems, cardsPerMode);
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
      case "surprise":
        result.surprise = selectAlbums(allItems, cardsPerMode, recentPicks, selectionConfig);
        break;
    }
  }

  res.json(result);
}

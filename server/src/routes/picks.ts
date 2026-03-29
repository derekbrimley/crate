import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  recordPick,
  getPickHistory,
  getLastPicksForUser,
  getItems,
  getConfig,
} from "../db/queries";
import { selectAlbums } from "../services/selection";
import { getContextSuggestions } from "../services/claude";

const router = Router();
router.use(requireAuth);

// GET /api/picks/dashboard — get suggestions for all modes
router.get("/dashboard", async (req, res) => {
  const userId = req.session.userId!;
  const cardsPerMode = getConfig<number>(userId, "cards_per_mode");
  const dashboardModes = getConfig<string[]>(userId, "dashboard_modes");
  const context = (req.query.context as string) || null;

  const allItems = getItems(userId);
  const favorites = allItems.filter((i) => i.list_type === "favorite");
  const recommendations = allItems.filter((i) => i.list_type === "recommendation");
  const recentPicks = getLastPicksForUser(userId);

  const result: Record<string, unknown> = {};

  for (const mode of dashboardModes) {
    switch (mode) {
      case "favorites": {
        result.favorites = selectAlbums(userId, favorites, cardsPerMode, recentPicks);
        break;
      }
      case "discover": {
        result.discover = selectAlbums(
          userId,
          recommendations,
          cardsPerMode,
          recentPicks
        );
        break;
      }
      case "for_right_now": {
        if (context && allItems.length > 0) {
          try {
            const suggestions = await getContextSuggestions(
              context,
              allItems,
              cardsPerMode
            );
            result.for_right_now = suggestions.length > 0
              ? suggestions
              : selectAlbums(userId, allItems, cardsPerMode, recentPicks);
          } catch {
            result.for_right_now = selectAlbums(userId, allItems, cardsPerMode, recentPicks);
          }
        } else {
          result.for_right_now = selectAlbums(userId, allItems, cardsPerMode, recentPicks);
        }
        break;
      }
      case "surprise": {
        result.surprise = selectAlbums(userId, allItems, cardsPerMode, recentPicks);
        break;
      }
    }
  }

  res.json(result);
});

// POST /api/picks — record a pick
router.post("/", (req, res) => {
  const { item_id, mode, context } = req.body as {
    item_id: number;
    mode: string;
    context?: string;
  };

  if (!item_id || !mode) {
    res.status(400).json({ error: "Missing item_id or mode" });
    return;
  }

  const pick = recordPick(req.session.userId!, item_id, mode, context || null);
  res.json({ pick });
});

// GET /api/picks/history
router.get("/history", (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const offset = parseInt((req.query.offset as string) || "0", 10);
  const history = getPickHistory(req.session.userId!, limit, offset);
  res.json({ history });
});

export default router;

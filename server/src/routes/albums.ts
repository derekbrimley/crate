import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  addItem,
  getItems,
  deleteItem,
  promoteItem,
} from "../db/queries";
import {
  searchAlbums,
  getBestImageUrl,
} from "../services/spotify";
import { invalidateSuggestionCache } from "../services/claude";

const router = Router();
router.use(requireAuth);

// GET /api/albums?list_type=favorite|recommendation
router.get("/", (req, res) => {
  const { list_type } = req.query as { list_type?: "favorite" | "recommendation" };
  const items = getItems(req.session.userId!, list_type);
  res.json({ items });
});

// POST /api/albums — add album to a list
router.post("/", async (req, res) => {
  const {
    spotify_id,
    title,
    artist,
    image_url,
    spotify_uri,
    spotify_url,
    list_type,
  } = req.body as {
    spotify_id: string;
    title: string;
    artist: string;
    image_url?: string;
    spotify_uri?: string;
    spotify_url?: string;
    list_type: "favorite" | "recommendation";
  };

  if (!spotify_id || !title || !artist || !list_type) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (list_type !== "favorite" && list_type !== "recommendation") {
    res.status(400).json({ error: "Invalid list_type" });
    return;
  }

  const item = addItem(
    req.session.userId!,
    list_type,
    title,
    artist,
    image_url || null,
    spotify_id,
    spotify_uri || `spotify:album:${spotify_id}`,
    spotify_url || `https://open.spotify.com/album/${spotify_id}`
  );

  invalidateSuggestionCache();
  res.json({ item });
});

// DELETE /api/albums/:id
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  deleteItem(req.session.userId!, id);
  invalidateSuggestionCache();
  res.json({ ok: true });
});

// POST /api/albums/:id/promote — recommendation → favorite
router.post("/:id/promote", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  promoteItem(req.session.userId!, id);
  invalidateSuggestionCache();
  res.json({ ok: true });
});

// GET /api/albums/search?q=... — search Spotify
router.get("/search", async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  const results = await searchAlbums(req.session.userId!, q);
  const albums = results.map((album) => ({
    spotify_id: album.id,
    title: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(album.images),
    spotify_uri: album.uri,
    spotify_url: album.external_urls.spotify,
  }));

  res.json({ albums });
});

export default router;

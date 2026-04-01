import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getItems, addItem } from "../../lib/queries";
import { fetchAlbumGenres } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const listType = req.query.list_type as "favorite" | "recommendation" | undefined;
    const items = await getItems(user.id, listType);
    return res.json({ items });
  }

  if (req.method === "POST") {
    const { spotify_id, title, artist, image_url, spotify_uri, spotify_url, list_type, genres } =
      req.body as {
        spotify_id: string;
        title: string;
        artist: string;
        image_url?: string;
        spotify_uri?: string;
        spotify_url?: string;
        list_type: "favorite" | "recommendation";
        genres?: string[];
      };

    if (!spotify_id || !title || !artist || !list_type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (list_type !== "favorite" && list_type !== "recommendation") {
      return res.status(400).json({ error: "Invalid list_type" });
    }

    // Fetch artist genres from Spotify (best-effort — don't block the add if it fails)
    let metadata: Record<string, unknown> = {};
    if (genres?.length) metadata.genres = genres;

    try {
      const fetchedGenres = await fetchAlbumGenres(spotify_id);
      if (fetchedGenres.length > 0) {
        metadata.genres = fetchedGenres;
      }
    } catch {
      // Genres unavailable — album still gets added without them
    }

    const item = await addItem(
      user.id,
      list_type,
      title,
      artist,
      image_url ?? null,
      spotify_id,
      spotify_uri ?? `spotify:album:${spotify_id}`,
      spotify_url ?? `https://open.spotify.com/album/${spotify_id}`,
      Object.keys(metadata).length > 0 ? metadata : null
    );

    return res.json({ item });
  }

  res.status(405).end();
}

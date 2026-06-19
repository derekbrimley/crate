import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { bulkAddItems } from "../../lib/queries";
import { getAlbumsBatch } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { albums, list_type } = req.body as {
    albums: {
      spotify_id: string;
      title: string;
      artist: string;
      image_url?: string;
      spotify_uri?: string;
      spotify_url?: string;
    }[];
    list_type: "favorite" | "recommendation";
  };

  if (!albums?.length) return res.status(400).json({ error: "No albums provided" });
  if (!list_type || !["favorite", "recommendation"].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type" });
  }

  // Best-effort: fetch release dates from Spotify (20 ids per request)
  const releaseDates = new Map<string, string>();
  try {
    for (let i = 0; i < albums.length; i += 20) {
      const chunk = albums.slice(i, i + 20).map((a) => a.spotify_id);
      const fetched = await getAlbumsBatch(chunk);
      for (const alb of fetched) {
        if (alb?.id && alb.release_date) releaseDates.set(alb.id, alb.release_date);
      }
    }
  } catch {
    // Spotify unavailable — albums still get added without release dates
  }

  const rows = albums.map((a) => {
    const rd = releaseDates.get(a.spotify_id);
    return {
      title: a.title,
      creator: a.artist,
      image_url: a.image_url ?? null,
      external_id: a.spotify_id,
      external_uri: a.spotify_uri ?? null,
      external_url: a.spotify_url ?? null,
      metadata: rd ? { release_date: rd } : null,
    };
  });

  try {
    const added = await bulkAddItems(user.id, list_type, rows);
    res.json({ added });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "Bulk add failed", detail: message });
  }
}

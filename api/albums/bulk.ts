import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { bulkAddItems } from "../../lib/queries";
import { albumFacts, getAlbumsBatch, getSavedDates } from "../../lib/spotify";

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

  // Best-effort: fetch each album's facts from Spotify (20 ids per request)
  // and when it was saved to the user's Spotify library.
  const facts = new Map<string, Record<string, unknown>>();
  let savedDates: Map<string, string> | null = null;
  try {
    for (let i = 0; i < albums.length; i += 20) {
      const chunk = albums.slice(i, i + 20).map((a) => a.spotify_id);
      for (const alb of await getAlbumsBatch(chunk)) {
        if (alb?.id) facts.set(alb.id, albumFacts(alb));
      }
    }
  } catch (err) {
    console.warn("Bulk import: Spotify fetch failed, albums added without metadata", err);
  }
  try {
    savedDates = await getSavedDates(user.id, albums.map((a) => a.spotify_id));
  } catch (err) {
    console.warn("Bulk import: Spotify library fetch failed, save dates left for the backfill", err);
  }

  const rows = albums.map((a) => {
    const metadata: Record<string, unknown> = { ...facts.get(a.spotify_id) };
    // null: looked for and not in the Spotify library, so the backfill skips it.
    if (savedDates) metadata.saved_at = savedDates.get(a.spotify_id) ?? null;
    return {
      title: a.title,
      creator: a.artist,
      image_url: a.image_url ?? null,
      external_id: a.spotify_id,
      external_uri: a.spotify_uri ?? null,
      external_url: a.spotify_url ?? null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
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

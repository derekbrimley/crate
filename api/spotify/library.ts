import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getSavedAlbums, getBestImageUrl } from "../../lib/spotify";
import { getItems } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
  const offset = parseInt(req.query.offset as string) || 0;

  let data;
  try {
    data = await getSavedAlbums(user.id, limit, offset);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const retryAfter = (err as { retryAfter?: number }).retryAfter;
    if (retryAfter) {
      return res.status(429).json({ error: message, retryAfter });
    }
    return res.status(502).json({ error: "Failed to fetch Spotify library", detail: message });
  }

  // Cross-reference with existing items
  const existingItems = await getItems(user.id);
  const existingMap = new Map(existingItems.map((item) => [item.external_id, item.list_type]));

  const albums = data.items.map((saved) => ({
    spotify_id: saved.album.id,
    title: saved.album.name,
    artist: saved.album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(saved.album.images),
    spotify_uri: saved.album.uri,
    spotify_url: saved.album.external_urls.spotify,
    total_tracks: saved.album.total_tracks,
    already_added: existingMap.get(saved.album.id) ?? null,
  }));

  res.json({ albums, total: data.total, limit, offset });
}

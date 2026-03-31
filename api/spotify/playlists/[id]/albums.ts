import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../../../lib/auth";
import { getPlaylistAlbums, getBestImageUrl } from "../../../../lib/spotify";
import { getItems } from "../../../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const playlistId = req.query.id as string;
  if (!playlistId) return res.status(400).json({ error: "Missing playlist ID" });

  let rawAlbums;
  try {
    rawAlbums = await getPlaylistAlbums(user.id, playlistId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const retryAfter = (err as { retryAfter?: number }).retryAfter;
    if (retryAfter) {
      return res.status(429).json({ error: message, retryAfter });
    }
    return res.status(502).json({ error: "Failed to fetch playlist albums", detail: message });
  }

  const existingItems = await getItems(user.id);
  const existingMap = new Map(existingItems.map((item) => [item.external_id, item.list_type]));

  const albums = rawAlbums.map((album) => ({
    spotify_id: album.spotify_id,
    title: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(album.images),
    spotify_uri: album.uri,
    spotify_url: album.external_urls.spotify,
    total_tracks: album.total_tracks,
    already_added: existingMap.get(album.spotify_id) ?? null,
  }));

  res.json({ albums });
}

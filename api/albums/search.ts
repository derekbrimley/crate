import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { searchAlbums, getBestImageUrl } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const q = req.query.q as string | undefined;
  if (!q) return res.status(400).json({ error: "Missing query" });

  let results;
  try {
    results = await searchAlbums(user.id, q);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify search failed", detail: message });
  }

  const albums = results.map((album) => ({
    spotify_id: album.id,
    title: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(album.images),
    spotify_uri: album.uri,
    spotify_url: album.external_urls.spotify,
  }));

  res.json({ albums });
}

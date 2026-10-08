import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { searchCatalog, getBestImageUrl } from "../../lib/spotify";
import { getItems } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const q = req.query.q as string | undefined;
  if (!q) return res.status(400).json({ error: "Missing query" });

  let results;
  try {
    results = await searchCatalog(q);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify search failed", detail: message });
  }

  const existingItems = await getItems(user.id);
  const existingMap = new Map(existingItems.map((item) => [item.external_id, item.list_type]));

  const albums = results.albums.map((album) => ({
    media_type: "album" as const,
    spotify_id: album.id,
    title: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(album.images),
    spotify_uri: album.uri,
    spotify_url: album.external_urls.spotify,
    total_tracks: album.total_tracks,
    already_added: existingMap.get(album.id) ?? null,
  }));

  // Playlists share the album row shape; the owner stands in for the artist.
  const playlists = results.playlists.map((pl) => ({
    media_type: "playlist" as const,
    spotify_id: pl.id,
    title: pl.name,
    artist: pl.owner?.display_name ?? "",
    image_url: getBestImageUrl(pl.images),
    spotify_uri: pl.uri,
    spotify_url: pl.external_urls?.spotify ?? `https://open.spotify.com/playlist/${pl.id}`,
    total_tracks: pl.tracks?.total,
    already_added: existingMap.get(pl.id) ?? null,
  }));

  res.json({ albums, playlists });
}

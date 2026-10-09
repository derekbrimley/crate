import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { searchAlbums, searchArtists, getArtistAlbums, getBestImageUrl, type SpotifyAlbum } from "../../lib/spotify";
import { getItems } from "../../lib/queries";

/**
 * Spotify search for the Search page.
 *   ?q=…              albums
 *   ?q=…&type=artist  artists
 *   ?artist=<id>      one artist's albums
 * Playlist search covers only the user's own playlists and is filtered on the
 * client from GET /api/spotify/playlists.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q : "";
  const artistId = typeof req.query.artist === "string" ? req.query.artist : "";
  const type = req.query.type === "artist" ? "artist" : "album";
  if (!q && !artistId) return res.status(400).json({ error: "Missing query" });

  try {
    if (!artistId && type === "artist") {
      const artists = await searchArtists(q);
      return res.json({
        artists: artists.map((a) => ({
          id: a.id,
          name: a.name,
          image_url: getBestImageUrl(a.images),
          genres: a.genres ?? [],
        })),
      });
    }

    const [albums, existingItems] = await Promise.all([
      artistId ? getArtistAlbums(artistId) : searchAlbums(q),
      getItems(user.id),
    ]);
    const existingMap = new Map(existingItems.map((item) => [item.external_id, item.list_type]));
    return res.json({ albums: albums.map((a) => toRow(a, existingMap.get(a.id) ?? null)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify search failed", detail: message });
  }
}

function toRow(album: SpotifyAlbum, alreadyAdded: string | null) {
  return {
    media_type: "album" as const,
    spotify_id: album.id,
    title: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    image_url: getBestImageUrl(album.images),
    spotify_uri: album.uri,
    spotify_url: album.external_urls.spotify,
    total_tracks: album.total_tracks,
    release_date: album.release_date,
    already_added: alreadyAdded,
  };
}

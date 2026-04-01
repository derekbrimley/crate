import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getAlbumFull, getAlbumTracks, getArtistAlbums, getBestImageUrl } from "../../../lib/spotify";
import { getItems } from "../../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const spotifyId = req.query.id as string;
  if (!spotifyId) return res.status(400).json({ error: "Missing album id" });

  try {
    // Fetch full album (includes artist IDs) and tracks in parallel
    const [album, tracks] = await Promise.all([
      getAlbumFull(user.id, spotifyId),
      getAlbumTracks(user.id, spotifyId),
    ]);

    // Get other albums by the primary artist
    const primaryArtist = album.artists[0];
    let otherAlbums: {
      spotify_id: string;
      title: string;
      artist: string;
      image_url: string | null;
      spotify_uri: string;
      spotify_url: string;
      total_tracks: number;
      already_added: "favorite" | "recommendation" | null;
    }[] = [];

    if (primaryArtist?.id) {
      const artistAlbums = await getArtistAlbums(user.id, primaryArtist.id);

      // Get user's existing items to mark which are already added
      const userItems = await getItems(user.id);
      const addedMap = new Map<string, "favorite" | "recommendation">();
      for (const item of userItems) {
        addedMap.set(item.external_id, item.list_type as "favorite" | "recommendation");
      }

      otherAlbums = artistAlbums
        .filter((a) => a.id !== spotifyId) // exclude current album
        .map((a) => ({
          spotify_id: a.id,
          title: a.name,
          artist: a.artists.map((ar) => ar.name).join(", "),
          image_url: getBestImageUrl(a.images),
          spotify_uri: a.uri,
          spotify_url: a.external_urls.spotify,
          total_tracks: a.total_tracks,
          already_added: addedMap.get(a.id) ?? null,
        }));
    }

    const trackList = tracks.map((t) => ({
      number: t.track_number,
      disc: t.disc_number,
      name: t.name,
      duration_ms: t.duration_ms,
      artists: t.artists.map((a) => a.name).join(", "),
    }));

    return res.json({
      tracks: trackList,
      artist_albums: otherAlbums,
    });
  } catch (err: any) {
    console.error("Album details error:", err);
    return res.status(500).json({ error: "Failed to fetch album details" });
  }
}

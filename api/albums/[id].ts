import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { deleteItem, promoteItem, updateItemListType, getItems } from "../../lib/queries";
import { getAlbumFull, getAlbumTracks, getArtistAlbums, getAlbumsBatch, getBestImageUrl, getArtistGenres } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const rawId = req.query.id as string;

  switch (req.method) {
    case "DELETE": {
      const id = parseInt(rawId, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      await deleteItem(user.id, id);
      return res.json({ ok: true });
    }

    case "POST": {
      const id = parseInt(rawId, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      await promoteItem(user.id, id);
      return res.json({ ok: true });
    }

    case "PATCH": {
      const id = parseInt(rawId, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      const { list_type } = req.body ?? {};
      if (list_type !== "favorite" && list_type !== "recommendation") {
        return res.status(400).json({ error: "list_type must be 'favorite' or 'recommendation'" });
      }
      await updateItemListType(user.id, id, list_type);
      return res.json({ ok: true });
    }

    case "GET": {
      const spotifyId = rawId;
      if (!spotifyId) return res.status(400).json({ error: "Missing album id" });

      try {
        const [album, tracks] = await Promise.all([
          getAlbumFull(spotifyId),
          getAlbumTracks(spotifyId),
        ]);

        const genres = await getArtistGenres(album.artists.map((a) => a.id));

        const primaryArtist = album.artists[0];
        let otherAlbums: {
          spotify_id: string;
          title: string;
          artist: string;
          image_url: string | null;
          spotify_uri: string;
          spotify_url: string;
          total_tracks: number;
          release_date: string;
          popularity: number;
          already_added: "favorite" | "recommendation" | null;
        }[] = [];

        if (primaryArtist?.id) {
          const artistAlbums = await getArtistAlbums(primaryArtist.id);
          const filtered = artistAlbums.filter((a) => a.id !== spotifyId);

          const [fullAlbums, userItems] = await Promise.all([
            getAlbumsBatch(filtered.map((a) => a.id)),
            getItems(user.id),
          ]);

          const popularityMap = new Map<string, number>();
          for (const a of fullAlbums) popularityMap.set(a.id, a.popularity ?? 0);

          const addedMap = new Map<string, "favorite" | "recommendation">();
          for (const item of userItems) {
            addedMap.set(item.external_id, item.list_type as "favorite" | "recommendation");
          }

          otherAlbums = filtered.map((a) => ({
            spotify_id: a.id,
            title: a.name,
            artist: a.artists.map((ar) => ar.name).join(", "),
            image_url: getBestImageUrl(a.images),
            spotify_uri: a.uri,
            spotify_url: a.external_urls.spotify,
            total_tracks: a.total_tracks,
            release_date: a.release_date,
            popularity: popularityMap.get(a.id) ?? 0,
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
          genres,
        });
      } catch (err: any) {
        console.error("Album details error:", err);
        return res.status(500).json({ error: "Failed to fetch album details" });
      }
    }

    default:
      return res.status(405).end();
  }
}

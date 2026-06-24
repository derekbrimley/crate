import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getSavedAlbums, getUserPlaylists, getPlaylistAlbums, getBestImageUrl, startPlayback } from "../../lib/spotify";
import { getItems } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const rawPath = req.query.path;
  const pathSegments = Array.isArray(rawPath)
    ? rawPath
    : rawPath
      ? rawPath.split("/")
      : (req.url ?? "").replace(/^\/api\/spotify\/?/, "").split("?")[0].split("/").filter(Boolean);
  const route = pathSegments.join("/");

  // PUT /api/spotify/play
  if (route === "play" && req.method === "PUT") {
    const { spotify_uri } = req.body as { spotify_uri?: string };
    if (!spotify_uri) return res.status(400).json({ error: "spotify_uri is required" });
    try {
      await startPlayback(user.id, spotify_uri);
      return res.status(204).end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("No active Spotify device") ? 404 : 502;
      return res.status(status).json({ error: message });
    }
  }

  // GET /api/spotify/library
  if (route === "library" && req.method === "GET") {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    let data;
    try {
      data = await getSavedAlbums(user.id, limit, offset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryAfter = (err as { retryAfter?: number }).retryAfter;
      if (retryAfter) return res.status(429).json({ error: message, retryAfter });
      return res.status(502).json({ error: "Failed to fetch Spotify library", detail: message });
    }
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
    return res.json({ albums, total: data.total, limit, offset });
  }

  // GET /api/spotify/playlists
  if (route === "playlists" && req.method === "GET") {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    let data;
    try {
      data = await getUserPlaylists(user.id, limit, offset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryAfter = (err as { retryAfter?: number }).retryAfter;
      if (retryAfter) return res.status(429).json({ error: message, retryAfter });
      return res.status(502).json({ error: "Failed to fetch playlists", detail: message });
    }
    const playlists = data.items.map((pl) => ({
      id: pl.id,
      name: pl.name,
      image_url: getBestImageUrl(pl.images),
      track_count: pl.tracks.total,
      owner: pl.owner.display_name,
    }));
    return res.json({ playlists, total: data.total, limit, offset });
  }

  // GET /api/spotify/playlists/:id/albums
  if (pathSegments[0] === "playlists" && pathSegments[2] === "albums" && req.method === "GET") {
    const playlistId = pathSegments[1];
    if (!playlistId) return res.status(400).json({ error: "Missing playlist ID" });
    let rawAlbums;
    try {
      rawAlbums = await getPlaylistAlbums(user.id, playlistId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryAfter = (err as { retryAfter?: number }).retryAfter;
      if (retryAfter) return res.status(429).json({ error: message, retryAfter });
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
    return res.json({ albums });
  }

  return res.status(404).json({ error: "Not found" });
}

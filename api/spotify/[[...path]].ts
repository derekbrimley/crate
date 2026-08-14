import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import {
  getSavedAlbums,
  getUserPlaylists,
  getPlaylistAlbums,
  getBestImageUrl,
  startPlayback,
  getDevices,
  getPlaybackState,
  controlPlayback,
  type PlayerAction,
} from "../../lib/spotify";
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

  // Playback always runs on a real Spotify client (phone/tablet/desktop app) via
  // Spotify Connect, so the device's own quality setting — including lossless —
  // applies. Nothing here renders audio in the browser.

  // PUT /api/spotify/play
  if (route === "play" && req.method === "PUT") {
    const { spotify_uri, device_id, offset } = req.body as { spotify_uri?: string; device_id?: string; offset?: number };
    if (!spotify_uri) return res.status(400).json({ error: "spotify_uri is required" });
    try {
      await startPlayback(user.id, spotify_uri, device_id, typeof offset === "number" ? offset : undefined);
      return res.status(204).end();
    } catch (err: unknown) {
      return sendPlayerError(res, err);
    }
  }

  // GET /api/spotify/devices — Spotify Connect targets for playback
  if (route === "devices" && req.method === "GET") {
    try {
      const devices = await getDevices(user.id);
      return res.json({ devices });
    } catch (err: unknown) {
      return sendPlayerError(res, err);
    }
  }

  // GET /api/spotify/state — what the active device is currently playing
  if (route === "state" && req.method === "GET") {
    try {
      const state = await getPlaybackState(user.id);
      if (!state) return res.json({ playing: null });
      return res.json({
        playing: state.item
          ? {
              uri: state.item.uri,
              name: state.item.name,
              artist: state.item.artists.map((a) => a.name).join(", "),
              image_url: getBestImageUrl(state.item.album?.images ?? []),
              duration: state.item.duration_ms,
              position: state.progress_ms ?? 0,
              paused: !state.is_playing,
            }
          : null,
        device: state.device
          ? {
              id: state.device.id,
              name: state.device.name,
              type: state.device.type,
              volume_percent: state.device.volume_percent,
              supports_volume: state.device.supports_volume,
            }
          : null,
      });
    } catch (err: unknown) {
      return sendPlayerError(res, err);
    }
  }

  // PUT /api/spotify/control — transport commands against a Connect device
  if (route === "control" && req.method === "PUT") {
    const { action, device_id, value } = req.body as { action?: string; device_id?: string; value?: number };
    const allowed: PlayerAction[] = ["resume", "pause", "next", "previous", "seek", "volume"];
    if (!action || !allowed.includes(action as PlayerAction)) {
      return res.status(400).json({ error: `action must be one of: ${allowed.join(", ")}` });
    }
    try {
      await controlPlayback(user.id, action as PlayerAction, device_id, value);
      return res.status(204).end();
    } catch (err: unknown) {
      return sendPlayerError(res, err);
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

/**
 * Player errors need the NO_DEVICE case distinguished so the client can prompt
 * the user to open Spotify instead of showing a generic failure.
 */
function sendPlayerError(res: VercelResponse, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if ((err as { code?: string }).code === "NO_DEVICE") {
    return res.status(404).json({ error: message, code: "NO_DEVICE" });
  }
  const retryAfter = (err as { retryAfter?: number }).retryAfter;
  if (retryAfter) return res.status(429).json({ error: message, retryAfter });
  return res.status(502).json({ error: message });
}

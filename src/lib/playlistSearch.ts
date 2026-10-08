import type { SpotifyPlaylistInfo } from "../types";

/**
 * Playlist search covers only the user's own Spotify playlists. A playlist
 * matches when every word of the query appears in its name or owner, so
 * "chill jazz" finds "Jazz for a chill morning".
 */
export function matchPlaylists(playlists: SpotifyPlaylistInfo[], query: string): SpotifyPlaylistInfo[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return playlists;
  return playlists.filter((pl) => {
    const haystack = `${pl.name} ${pl.owner ?? ""}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

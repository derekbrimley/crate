import type { Item, MediaType } from "../types";

/**
 * Library items are albums or playlists. Rows that don't come straight from
 * the items table (e.g. history entries) may lack media_type, so the Spotify
 * URI breaks the tie.
 */
export function mediaTypeOf(item: Pick<Item, "media_type" | "external_uri">): MediaType {
  if (item.media_type === "playlist" || item.media_type === "album") return item.media_type;
  return item.external_uri?.startsWith("spotify:playlist:") ? "playlist" : "album";
}

export function isPlaylist(item: Pick<Item, "media_type" | "external_uri">): boolean {
  return mediaTypeOf(item) === "playlist";
}

/** The Spotify context URI that plays this item. */
export function spotifyUriOf(item: Pick<Item, "media_type" | "external_uri" | "external_id">): string | null {
  if (item.external_uri) return item.external_uri;
  if (!item.external_id) return null;
  return `spotify:${mediaTypeOf(item)}:${item.external_id}`;
}

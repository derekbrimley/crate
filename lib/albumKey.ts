/**
 * Spotify ids alone don't dedupe: one album appears under several ids
 * (remasters, deluxe and regional editions). Also compare a normalized
 * title + artist, ignoring parentheticals like "(Deluxe Edition)".
 */
export function albumKey(title: string, artist: string): string {
  const clean = (s: string) =>
    s.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/[^a-z0-9]/g, "");
  return `${clean(title)}|${clean(artist)}`;
}

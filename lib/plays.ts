/**
 * Every successful play of a library item counts as a pick, whichever page
 * started it. Picks are recorded server-side in PUT /api/spotify/play so no
 * page can forget to report one, and so search results — which don't know
 * the library row id — still count.
 */

export interface PlayTarget {
  mediaType: "album" | "playlist";
  externalId: string;
}

/** Parses a `spotify:album:<id>` or `spotify:playlist:<id>` context URI. */
export function parsePlayTarget(uri: string): PlayTarget | null {
  const match = /^spotify:(album|playlist):([A-Za-z0-9]+)$/.exec(uri);
  if (!match) return null;
  return { mediaType: match[1] as PlayTarget["mediaType"], externalId: match[2] };
}

/**
 * Starting several tracks of one album in a row (from its track list) is one
 * listen, not several. A play within this window of the item's previous pick
 * isn't recorded again.
 */
export const REPLAY_WINDOW_SECONDS = 60 * 60;

export function isRepeatPlay(lastPickedAt: number | null, now: number): boolean {
  return lastPickedAt !== null && now - lastPickedAt < REPLAY_WINDOW_SECONDS;
}

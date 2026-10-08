import { suggestAlbums } from "./claude";
import { searchAlbums, getBestImageUrl } from "./spotify";
import { albumKey } from "./albumKey";
import type { Item } from "./types";

/**
 * Claude's album ideas for a taste (`seed`), matched to real Spotify albums and
 * shaped as Items. They aren't library rows, so they get negative ids (unique,
 * and the details pane offers "add to library" for them) and `_ai_suggested`.
 */
export async function suggestionItems(
  userId: number,
  seed: Item[],
  library: Item[],
  theme: string | undefined,
  count = 6
): Promise<Item[]> {
  const ideas = await suggestAlbums(seed, library, theme, count);
  const ownedIds = new Set(library.map((i) => i.external_id));
  const ownedKeys = new Set(library.map((i) => albumKey(i.title, i.creator)));

  const matches = await Promise.all(
    ideas.map(({ title, artist }) => searchAlbums(`${title} ${artist}`, 5).catch(() => []))
  );

  const out: Item[] = [];
  const chosen = new Set<string>();
  ideas.forEach((idea, i) => {
    const match = matches[i].find((r) => {
      const key = albumKey(r.name, r.artists[0]?.name ?? idea.artist);
      return !ownedIds.has(r.id) && !ownedKeys.has(key) && !chosen.has(key);
    });
    if (!match) return;
    chosen.add(albumKey(match.name, match.artists[0]?.name ?? idea.artist));
    out.push({
      id: -(out.length + 1),
      user_id: userId,
      media_type: "album",
      list_type: "recommendation",
      title: match.name,
      creator: match.artists.map((a) => a.name).join(", ") || idea.artist,
      image_url: getBestImageUrl(match.images),
      external_id: match.id,
      external_uri: match.uri,
      external_url: match.external_urls.spotify,
      added_at: 0,
      metadata: { _ai_suggested: true },
    });
  });
  return out;
}

import Anthropic from "@anthropic-ai/sdk";
import type { Item, LastPickInfo, RightNowContext } from "./types";
import { selectAlbums, type SelectionConfig } from "./selection";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Context → Genre Profiles ─────────────────────────────────────────────────

const CONTEXT_GENRE_PROFILES: Record<string, string[]> = {
  morning: ["classical", "ambient", "electronic", "instrumental", "lo-fi", "neo-classical", "folk", "acoustic", "singer-songwriter", "jazz"],
  gym: ["hip hop", "rap", "metal", "rock", "electronic", "edm", "pop", "punk", "hard rock", "drum and bass"],
  driving: ["rock", "classic rock", "pop", "hip hop", "country", "alternative", "indie", "electronic"],
  deep_work: ["ambient", "electronic", "post-rock", "classical", "instrumental", "jazz", "lo-fi", "neo-classical"],
  cooking: ["pop", "soul", "r&b", "jazz", "funk", "bossa nova", "latin", "indie pop"],
  hosting: ["pop", "indie pop", "soul", "r&b", "funk", "jazz", "latin", "dance"],
  walking: ["pop", "indie", "rock", "hip hop", "electronic", "folk", "jazz", "classical"],
  chill: ["lo-fi", "chillhop", "indie", "soul", "r&b", "jazz", "ambient", "neo-soul", "folk"],
  winding_down: ["ambient", "folk", "acoustic", "indie folk", "classical", "singer-songwriter", "jazz", "lo-fi", "neo-soul"],
};

function albumMatchesGenres(item: Item, preferGenres: string[]): boolean {
  if (preferGenres.length === 0) return true;
  const genres = (item.metadata?.genres as string[] | undefined) ?? [];
  if (genres.length === 0) return false;
  const normalizedGenres = new Set(genres.map(g => g.toLowerCase()));
  return preferGenres.some(term => normalizedGenres.has(term.toLowerCase()));
}

function resolvePreferGenres(context: string, contextProfile?: RightNowContext): string[] {
  if (contextProfile?.prefer_genres?.length) return contextProfile.prefer_genres;
  const lower = context.toLowerCase();
  for (const [keyword, genres] of Object.entries(CONTEXT_GENRE_PROFILES)) {
    if (lower.includes(keyword.replace("_", " ")) || lower.includes(keyword)) {
      return genres;
    }
  }
  return [];
}

const SURPRISE_SYSTEM_PROMPT = `You are a music curator for a personal album-picker app called Crate.
The user has a set of favorite albums that represent their taste.
Suggest 5 albums they would love that are NOT already in their library — albums they likely haven't heard but would genuinely enjoy.
Make the suggestions varied: different artists, different eras, different moods — but all fitting the taste profile.
Consider genre overlap, artist style, era, and mood from their favorites.
Return ONLY a JSON array with 5 objects: [{"title": "Album Title", "artist": "Artist Name"}, ...]
No explanation, no markdown, just the raw JSON array.`;

export async function getSurpriseSuggestion(
  favorites: Item[]
): Promise<{ title: string; artist: string }[]> {
  if (favorites.length === 0) return [];

  const favoritesPayload = favorites.slice(0, 15).map((item) => ({
    title: item.title,
    artist: item.creator,
    genres: (item.metadata?.genres as string[]) || [],
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SURPRISE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `My favorite albums:\n${JSON.stringify(favoritesPayload)}\n\nSuggest 5 varied albums I would love.`,
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s): s is { title: string; artist: string } =>
          typeof s?.title === "string" && typeof s?.artist === "string"
      );
    }
  } catch {
    // Return empty on failure
  }

  return [];
}

export function getContextSuggestions(
  context: string,
  items: Item[],
  count: number,
  contextProfile: RightNowContext | undefined,
  recentPicks: LastPickInfo[],
  selectionConfig: SelectionConfig
): Item[] {
  if (items.length === 0) return [];

  const preferGenres = resolvePreferGenres(context, contextProfile);
  const filtered = items.filter(item => albumMatchesGenres(item, preferGenres));
  const pool = filtered.length > 0 ? filtered : items;

  return selectAlbums(pool, count, recentPicks, selectionConfig);
}

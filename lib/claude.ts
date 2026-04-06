import Anthropic from "@anthropic-ai/sdk";
import type { Item, LastPickInfo, RightNowContext } from "./types";

const SECONDS_PER_DAY = 86400;

function daysAgo(unixTimestamp: number): number {
  return (Math.floor(Date.now() / 1000) - unixTimestamp) / SECONDS_PER_DAY;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Context → Genre Profiles ─────────────────────────────────────────────────
// Maps context keywords to genre terms that are likely a good match.
// Used for pre-filtering before sending to Claude.
// Genres come from Spotify's artist genre taxonomy (lowercase, hyphenated).

const CONTEXT_GENRE_PROFILES: Record<string, { prefer: string[]; avoid: string[] }> = {
  morning: {
    prefer: ["classical", "ambient", "electronic", "instrumental", "lo-fi", "neo-classical", "folk", "acoustic", "singer-songwriter", "jazz"],
    avoid: ["metal", "punk", "rock"],
  },
  gym: {
    prefer: ["hip hop", "rap", "metal", "rock", "electronic", "edm", "pop", "punk", "hard rock", "drum and bass"],
    avoid: ["ambient", "classical", "folk", "acoustic", "sleep", "meditation", "jazz"],
  },
  driving: {
    prefer: ["rock", "classic rock", "pop", "hip hop", "country", "alternative", "indie", "electronic"],
    avoid: ["ambient", "classical", "sleep", "meditation"],
  },
  deep_work: {
    prefer: ["ambient", "electronic", "post-rock", "classical", "instrumental", "jazz", "lo-fi", "neo-classical"],
    avoid: ["hip hop", "rap", "metal", "pop", "punk", "comedy"],
  },
  cooking: {
    prefer: ["pop", "soul", "r&b", "jazz", "funk", "bossa nova", "latin", "indie pop"],
    avoid: ["metal", "ambient", "classical", "sleep"],
  },
  hosting: {
    prefer: ["pop", "indie pop", "soul", "r&b", "funk", "jazz", "latin", "dance"],
    avoid: ["metal", "ambient", "sleep", "meditation"],
  },
  walking: {
    prefer: ["pop", "indie", "rock", "hip hop", "electronic", "folk", "jazz", "classical"],
    avoid: ["ambient", "sleep", "meditation"],
  },
  chill: {
    prefer: ["lo-fi", "chillhop", "indie", "soul", "r&b", "jazz", "ambient", "neo-soul", "folk"],
    avoid: ["metal", "punk", "edm", "drum and bass"],
  },
  winding_down: {
    prefer: ["ambient", "folk", "acoustic", "indie folk", "classical", "singer-songwriter", "jazz", "lo-fi", "neo-soul"],
    avoid: ["metal", "punk", "hip hop", "edm", "drum and bass"],
  },
};

function scoreAlbum(item: Item, profile: { prefer: string[] }): number {
  const genres = (item.metadata?.genres as string[] | undefined) ?? [];
  if (genres.length === 0) return 0.1;

  const normalizedGenres = new Set(genres.map(g => g.toLowerCase()));

  let preferMatches = 0;
  for (const term of profile.prefer) {
    if (normalizedGenres.has(term.toLowerCase())) preferMatches++;
  }
  
  if (preferMatches > 0) return 0.5 + Math.min(preferMatches * 0.15, 0.5);
  return 0.5;
}

function resolveProfile(context: string): { prefer: string[]; avoid: string[] } | null {
  const lower = context.toLowerCase();
  for (const [keyword, p] of Object.entries(CONTEXT_GENRE_PROFILES)) {
    if (lower.includes(keyword.replace("_", " ")) || lower.includes(keyword)) {
      return p;
    }
  }
  return null;
}

function recencyMultiplier(
  itemId: number,
  pickMap: Map<number, LastPickInfo>,
  weightRecentDays: number,
  weightMediumDays: number
): number {
  const info = pickMap.get(itemId);
  if (!info) return 1.0;
  const days = daysAgo(info.picked_at);
  if (days < weightRecentDays) return 0.5;
  if (days < weightMediumDays) return 0.75;
  return 1.0;
}

function preFilterAlbums(
  items: Item[],
  profile: { prefer: string[]; avoid: string[] } | null,
  maxCandidates: number,
  pickMap: Map<number, LastPickInfo>,
  weightRecentDays: number,
  weightMediumDays: number,
  randomnessFactor: number = 1.0
): Item[] {
  const scored = items.map((item) => {
    const genreScore = profile ? scoreAlbum(item, profile) : 0.5;
    const recency = recencyMultiplier(item.id, pickMap, weightRecentDays, weightMediumDays);
    const base = genreScore * recency;
    const jittered = base * Math.pow(Math.random(), 1 / randomnessFactor);
    return { item, score: jittered };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCandidates).map((s) => s.item);
}

// ── Claude integration ──────────────────────────────────────────────────────

const MAX_CANDIDATES = 30; // Max albums sent to Claude after pre-filtering

const SYSTEM_PROMPT = `You are a music curator for a personal album-picker app called Crate. The user will give you a listening context (an activity, mood, or setting) and a list of albums from their library with genres.

Your job: pick the albums that best fit the context.

CONTEXT MATCHING GUIDELINES:
- High-energy activities (gym, running, cleaning): favor energetic genres — rock, metal, hip hop, electronic, punk, drum and bass
- Focus/study/deep work: favor instrumental or low-distraction genres — ambient, post-rock, classical, jazz, lo-fi
- Relaxation/winding down: favor calm genres — ambient, folk, acoustic, indie folk, neo-soul, classical
- Social/hosting/party: favor upbeat, danceable genres — pop, funk, soul, latin, dance
- Morning/coffee: favor lighter genres — indie pop, folk, acoustic, singer-songwriter, jazz
- Driving: favor energetic or mood-setting genres — rock, classic rock, pop, hip hop, country
- Cooking/chores: favor upbeat, fun genres — soul, r&b, pop, funk, bossa nova
- Emotional contexts (sad, heartbreak, nostalgic): match the mood — folk, singer-songwriter, indie, blues
- If a specific genre is mentioned in the context, prioritize genre match above all else

When the context is ambiguous or creative (e.g., "alien invasion", "first date"), use your best judgment — think about what music would genuinely enhance that experience. Use artist and album names as additional signals when genres are sparse.

Return ONLY a JSON array of album IDs (integers) in your recommended order, best match first. No explanation, no markdown, just the raw JSON array. Example: [42, 7, 13]`;

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

export interface PickFilterConfig {
  cooldown_days: number;
  weight_recent_days: number;
  weight_medium_days: number;
  randomness_factor: number;
}

export async function getContextSuggestions(
  context: string,
  items: Item[],
  count: number,
  contextProfile?: RightNowContext,
  recentPicks?: LastPickInfo[],
  pickFilterConfig?: PickFilterConfig
): Promise<Item[]> {
  if (items.length === 0) return [];

  const cooldownDays = pickFilterConfig?.cooldown_days ?? 3;
  const weightRecentDays = pickFilterConfig?.weight_recent_days ?? 14;
  const weightMediumDays = pickFilterConfig?.weight_medium_days ?? 30;
  const randomnessFactor = pickFilterConfig?.randomness_factor ?? 1.0;

  const pickMap = new Map<number, LastPickInfo>();
  for (const p of recentPicks ?? []) pickMap.set(p.item_id, p);

  // Exclude albums within cooldown before Claude even sees them
  const eligible = items.filter((item) => {
    const info = pickMap.get(item.id);
    if (!info) return true;
    return daysAgo(info.picked_at) >= cooldownDays;
  });

  const profile = contextProfile
    ? { prefer: contextProfile.prefer_genres, avoid: [] as string[] }
    : resolveProfile(context);

  // Pre-filter by genre fit + recency penalty to reduce token usage
  const candidates = preFilterAlbums(eligible, profile, MAX_CANDIDATES, pickMap, weightRecentDays, weightMediumDays, randomnessFactor);

  const albumsPayload = candidates.map((item) => ({
    id: item.id,
    title: item.title,
    artist: item.creator,
    list_type: item.list_type,
    genres: (item.metadata?.genres as string[]) || [],
  }));

  // Ask for a larger pool so we can randomly sample from it, giving variety on each refresh
  const poolSize = Math.min(count * 4, MAX_CANDIDATES);
  let userMessage = `Context: "${context}"\n\nAlbums:\n${JSON.stringify(albumsPayload)}\n\nReturn the ${poolSize} best album IDs for this context.`;
  if (contextProfile?.prompt_hints?.trim()) {
    userMessage += `\n\nAdditional hint: ${contextProfile.prompt_hints.trim()}`;
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  let suggestedIds: number[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      suggestedIds = parsed.filter((id): id is number => typeof id === "number");
    }
  } catch {
    // Return empty on parse failure
  }

  // Build the pool from Claude's ranked results.
  // Safety net: re-filter cooldown albums in case Claude returned IDs not in our filtered set.
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const pool = suggestedIds
    .map((id) => itemMap.get(id))
    .filter((i): i is Item => {
      if (!i) return false;
      const info = pickMap.get(i.id);
      if (!info) return true;
      return daysAgo(info.picked_at) >= cooldownDays;
    });

  return pool.sort(() => Math.random() - 0.5).slice(0, count);
}

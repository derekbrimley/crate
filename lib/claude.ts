import Anthropic from "@anthropic-ai/sdk";
import type { Item } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Context → Genre Profiles ─────────────────────────────────────────────────
// Maps context keywords to genre terms that are likely a good match.
// Used for pre-filtering before sending to Claude.
// Genres come from Spotify's artist genre taxonomy (lowercase, hyphenated).

const CONTEXT_GENRE_PROFILES: Record<string, { prefer: string[]; avoid: string[] }> = {
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
  winding_down: {
    prefer: ["ambient", "folk", "acoustic", "indie folk", "classical", "singer-songwriter", "jazz", "lo-fi", "neo-soul"],
    avoid: ["metal", "punk", "hip hop", "edm", "drum and bass"],
  },
  hosting: {
    prefer: ["pop", "indie pop", "soul", "r&b", "funk", "jazz", "latin", "dance"],
    avoid: ["metal", "ambient", "sleep", "meditation"],
  },
  morning: {
    prefer: ["indie pop", "folk", "acoustic", "singer-songwriter", "pop", "jazz", "soul"],
    avoid: ["metal", "punk", "ambient", "sleep"],
  },
  walking: {
    prefer: ["pop", "indie", "rock", "hip hop", "electronic", "folk"],
    avoid: ["ambient", "sleep", "meditation", "classical"],
  },
  chill: {
    prefer: ["lo-fi", "chillhop", "indie", "soul", "r&b", "jazz", "ambient", "neo-soul", "folk"],
    avoid: ["metal", "punk", "edm", "drum and bass"],
  },
};

// Score an album against a genre profile.
// Returns 1.0 for preferred match, 0.0 for avoided genre, 0.5 for neutral.
function scoreAlbumForContext(item: Item, context: string): number {
  const lower = context.toLowerCase();

  // Find matching profile
  let profile: { prefer: string[]; avoid: string[] } | null = null;
  for (const [keyword, p] of Object.entries(CONTEXT_GENRE_PROFILES)) {
    if (lower.includes(keyword.replace("_", " ")) || lower.includes(keyword)) {
      profile = p;
      break;
    }
  }
  if (!profile) return 0.5;

  const genres = (item.metadata?.genres as string[] | undefined) ?? [];
  if (genres.length === 0) return 0.5; // No genre data — neutral score

  const genreStr = genres.join(" ").toLowerCase();

  let preferMatches = 0;
  for (const term of profile.prefer) {
    if (genreStr.includes(term)) preferMatches++;
  }
  for (const term of profile.avoid) {
    if (genreStr.includes(term)) return 0.1; // Strong penalty
  }

  if (preferMatches > 0) return 0.5 + Math.min(preferMatches * 0.15, 0.5);
  return 0.5;
}

// Pre-filter albums by genre relevance, return top N candidates for Claude.
function preFilterAlbums(
  items: Item[],
  context: string,
  maxCandidates: number
): Item[] {
  const scored = items
    .map((item) => ({ item, score: scoreAlbumForContext(item, context) }))
    .sort((a, b) => b.score - a.score);

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

export async function getContextSuggestions(
  context: string,
  items: Item[],
  count: number
): Promise<Item[]> {
  if (items.length === 0) return [];

  // Pre-filter to reduce token usage
  const candidates = preFilterAlbums(items, context, MAX_CANDIDATES);

  const albumsPayload = candidates.map((item) => ({
    id: item.id,
    title: item.title,
    artist: item.creator,
    list_type: item.list_type,
    genres: (item.metadata?.genres as string[]) || [],
  }));

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Context: "${context}"\n\nAlbums:\n${JSON.stringify(albumsPayload)}\n\nReturn the ${count} best album IDs for this context.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  let suggestedIds: number[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      suggestedIds = parsed.filter((id): id is number => typeof id === "number");
    }
  } catch {
    // Return empty on parse failure
  }

  // Preserve Claude's ordering
  const itemMap = new Map(items.map((i) => [i.id, i]));
  return suggestedIds
    .map((id) => itemMap.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, count);
}

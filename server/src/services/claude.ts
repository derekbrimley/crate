import Anthropic from "@anthropic-ai/sdk";
import { Item } from "../db/queries";
import crypto from "crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple in-memory cache: key = hash(context + albumListHash) → item IDs
const suggestionCache = new Map<string, number[]>();

function hashItems(items: Item[]): string {
  const ids = items
    .map((i) => i.id)
    .sort()
    .join(",");
  return crypto.createHash("md5").update(ids).digest("hex");
}

function cacheKey(context: string, items: Item[]): string {
  return `${context}::${hashItems(items)}`;
}

export async function getContextSuggestions(
  context: string,
  items: Item[],
  count: number
): Promise<Item[]> {
  if (items.length === 0) return [];

  const key = cacheKey(context, items);
  if (suggestionCache.has(key)) {
    const cachedIds = suggestionCache.get(key)!;
    return items.filter((i) => cachedIds.includes(i.id)).slice(0, count);
  }

  const albumsPayload = items.map((item) => {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    return {
      id: item.id,
      title: item.title,
      artist: item.creator,
      genres: meta.genres || [],
      avg_energy: meta.avg_energy,
      avg_tempo: meta.avg_tempo,
      avg_valence: meta.avg_valence,
      avg_danceability: meta.avg_danceability,
    };
  });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "You are a music curator. Given a list of albums with metadata, suggest the best albums for the given listening context. Return ONLY a JSON array of item IDs (integers) — no explanation, no markdown, just the raw JSON array. Example: [42, 7, 13]",
    messages: [
      {
        role: "user",
        content: `Context: "${context}". Albums: ${JSON.stringify(albumsPayload)}. Return ${count} album IDs that best fit this context.`,
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
    // If parsing fails, return empty
  }

  suggestionCache.set(key, suggestedIds);

  return items.filter((i) => suggestedIds.includes(i.id)).slice(0, count);
}

export function invalidateSuggestionCache(): void {
  suggestionCache.clear();
}

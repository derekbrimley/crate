import Anthropic from "@anthropic-ai/sdk";
import type { Item } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getContextSuggestions(
  context: string,
  items: Item[],
  count: number
): Promise<Item[]> {
  if (items.length === 0) return [];

  const albumsPayload = items.map((item) => {
    const meta = item.metadata ?? {};
    return {
      id: item.id,
      title: item.title,
      artist: item.creator,
      genres: (meta.genres as string[]) || [],
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
    // Return empty on parse failure
  }

  return items.filter((i) => suggestedIds.includes(i.id)).slice(0, count);
}

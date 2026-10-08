import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Item } from "./types";

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

const MODEL = "claude-haiku-5-5";

const SuggestionsSchema = z.object({
  albums: z.array(z.object({ title: z.string(), artist: z.string() })),
});

export type AlbumSuggestion = z.infer<typeof SuggestionsSchema>["albums"][number];

const SYSTEM_PROMPT = `You are a music curator for a personal album-picker app called Crates.
The user gives you albums that represent a taste (sometimes with a theme for the set), plus albums already in their library.
Suggest albums they would love that are NOT in their library and NOT by an artist already heavily represented there: records they likely haven't heard but would genuinely enjoy.
Make the suggestions varied (different artists, eras and moods) while fitting the taste and theme.
Only suggest real, released full-length albums.`;

function genresOf(item: Item): string[] {
  const m = item.metadata;
  if (!m || typeof m !== "object") return [];
  const g = (m as Record<string, unknown>).genres;
  return Array.isArray(g) ? (g as string[]) : [];
}

/**
 * Asks Claude for `count` albums that fit `seed` (the taste to match) and aren't
 * in `library`. `theme` is an optional hint, e.g. the crate's name. Returns []
 * when there's nothing to go on or the call fails; callers treat suggestions
 * as a nice-to-have.
 */
export async function suggestAlbums(
  seed: Item[],
  library: Item[],
  theme: string | undefined,
  count = 6
): Promise<AlbumSuggestion[]> {
  if (seed.length === 0) return [];

  const taste = seed.slice(0, 20).map((i) => ({ title: i.title, artist: i.creator, genres: genresOf(i) }));
  // Capped so a huge library doesn't blow the token budget.
  const owned = library.slice(0, 250).map((i) => `${i.title} — ${i.creator}`);

  const userMessage =
    `Albums that represent the taste:\n${JSON.stringify(taste)}\n\n` +
    (theme?.trim() ? `Theme for this set: ${theme.trim()}\n\n` : "") +
    `Already in my library (do NOT suggest these):\n${owned.join("\n")}\n\n` +
    `Suggest ${count} albums.`;

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(SuggestionsSchema) },
    });
    if (response.stop_reason === "refusal") return [];
    return response.parsed_output?.albums.slice(0, count) ?? [];
  } catch (err) {
    console.error("Claude suggestions failed:", err);
    return [];
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getItemsMissingMetadata, updateItemMetadata } from "../../lib/queries";
import { albumFacts, getAlbumsBatch, getSavedDates } from "../../lib/spotify";
import { BACKFILL_KEYS } from "../../lib/filters";

const BATCH = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  // A batch per call keeps each request well inside the function time limit;
  // the client calls again while `remaining` is above zero.
  const missing = await getItemsMissingMetadata(user.id);
  const items = missing.slice(0, BATCH);
  const remaining = missing.length - items.length;
  if (items.length === 0) return res.json({ updated: 0, remaining: 0 });

  const facts = new Map<string, Record<string, unknown>>();
  let savedDates: Map<string, string> | null = null;

  try {
    const ids = items.map((i) => i.external_id);
    for (let i = 0; i < ids.length; i += 20) {
      for (const alb of await getAlbumsBatch(ids.slice(i, i + 20))) {
        if (alb?.id) facts.set(alb.id, albumFacts(alb));
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify fetch failed", detail: message });
  }

  const needsSavedAt = items.filter((i) => meta(i.metadata).saved_at === undefined);
  if (needsSavedAt.length > 0) {
    try {
      savedDates = await getSavedDates(user.id, needsSavedAt.map((i) => i.external_id));
    } catch (err) {
      console.warn("Backfill: Spotify library fetch failed, save dates left for next time", err);
    }
  }

  // Merge fetched fields into each item's existing metadata. Whatever Spotify
  // had no answer for becomes null, so it isn't looked for again.
  const updates = [];
  for (const item of items) {
    const existing = meta(item.metadata);
    const next: Record<string, unknown> = { ...existing, ...facts.get(item.external_id) };
    if (savedDates && existing.saved_at === undefined) next.saved_at = savedDates.get(item.external_id) ?? null;
    for (const key of BACKFILL_KEYS) {
      if (key === "saved_at" && !savedDates) continue;
      if (next[key] === undefined) next[key] = null;
    }
    if (JSON.stringify(next) !== JSON.stringify(existing)) updates.push(updateItemMetadata(user.id, item.id, next));
  }

  await Promise.all(updates);
  res.json({ updated: updates.length, remaining });
}

function meta(m: unknown): Record<string, unknown> {
  if (!m) return {};
  if (typeof m === "string") {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return m as Record<string, unknown>;
}

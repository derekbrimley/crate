import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getItemsMissingMetadata, updateItemMetadata } from "../../lib/queries";
import { getAlbumsBatch } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const items = await getItemsMissingMetadata(user.id);
  if (items.length === 0) return res.json({ updated: 0 });

  // Map external_id -> item so we can merge metadata back.
  const byExternalId = new Map(items.map((i) => [i.external_id, i]));
  const releaseDates = new Map<string, string>();
  const trackCounts = new Map<string, number>();

  try {
    const ids = items.map((i) => i.external_id);
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const fetched = await getAlbumsBatch(chunk);
      for (const alb of fetched) {
        if (alb?.id && alb.release_date) releaseDates.set(alb.id, alb.release_date);
        if (alb?.id && typeof alb.total_tracks === "number") trackCounts.set(alb.id, alb.total_tracks);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify fetch failed", detail: message });
  }

  // Merge fetched fields into each item's existing metadata.
  const externalIds = new Set([...releaseDates.keys(), ...trackCounts.keys()]);
  const updates = [];
  for (const externalId of externalIds) {
    const item = byExternalId.get(externalId);
    if (!item) continue;
    const existing = (item.metadata as Record<string, unknown> | null) ?? {};
    const next: Record<string, unknown> = { ...existing };
    const rd = releaseDates.get(externalId);
    const tc = trackCounts.get(externalId);
    if (rd) next.release_date = rd;
    if (typeof tc === "number") next.total_tracks = tc;
    updates.push(updateItemMetadata(user.id, item.id, next));
  }

  await Promise.all(updates);
  const updated = updates.length;

  res.json({ updated });
}

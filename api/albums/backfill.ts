import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getItemsMissingReleaseDate, updateItemMetadata } from "../../lib/queries";
import { getAlbumsBatch } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const items = await getItemsMissingReleaseDate(user.id);
  if (items.length === 0) return res.json({ updated: 0 });

  // Map external_id -> item so we can merge metadata back.
  const byExternalId = new Map(items.map((i) => [i.external_id, i]));
  const releaseDates = new Map<string, string>();

  try {
    const ids = items.map((i) => i.external_id);
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const fetched = await getAlbumsBatch(chunk);
      for (const alb of fetched) {
        if (alb?.id && alb.release_date) releaseDates.set(alb.id, alb.release_date);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Spotify fetch failed", detail: message });
  }

  let updated = 0;
  for (const [externalId, rd] of releaseDates) {
    const item = byExternalId.get(externalId);
    if (!item) continue;
    const existing = (item.metadata as Record<string, unknown> | null) ?? {};
    await updateItemMetadata(user.id, item.id, { ...existing, release_date: rd });
    updated++;
  }

  res.json({ updated });
}

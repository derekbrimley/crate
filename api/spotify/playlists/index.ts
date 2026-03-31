import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getUserPlaylists, getBestImageUrl } from "../../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
  const offset = parseInt(req.query.offset as string) || 0;

  let data;
  try {
    data = await getUserPlaylists(user.id, limit, offset);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const retryAfter = (err as { retryAfter?: number }).retryAfter;
    if (retryAfter) {
      return res.status(429).json({ error: message, retryAfter });
    }
    return res.status(502).json({ error: "Failed to fetch playlists", detail: message });
  }

  const playlists = data.items.map((pl) => ({
    id: pl.id,
    name: pl.name,
    image_url: getBestImageUrl(pl.images),
    track_count: pl.tracks.total,
    owner: pl.owner.display_name,
  }));

  res.json({ playlists, total: data.total, limit, offset });
}

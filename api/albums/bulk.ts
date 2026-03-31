import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { bulkAddItems } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { albums, list_type } = req.body as {
    albums: {
      spotify_id: string;
      title: string;
      artist: string;
      image_url?: string;
      spotify_uri?: string;
      spotify_url?: string;
    }[];
    list_type: "favorite" | "recommendation";
  };

  if (!albums?.length) return res.status(400).json({ error: "No albums provided" });
  if (!list_type || !["favorite", "recommendation"].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type" });
  }

  const rows = albums.map((a) => ({
    title: a.title,
    creator: a.artist,
    image_url: a.image_url ?? null,
    external_id: a.spotify_id,
    external_uri: a.spotify_uri ?? null,
    external_url: a.spotify_url ?? null,
  }));

  try {
    const added = await bulkAddItems(user.id, list_type, rows);
    res.json({ added });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "Bulk add failed", detail: message });
  }
}

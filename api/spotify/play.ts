import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { startPlayback } from "../../lib/spotify";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { spotify_uri } = req.body as { spotify_uri?: string };
  if (!spotify_uri) return res.status(400).json({ error: "spotify_uri is required" });

  try {
    await startPlayback(user.id, spotify_uri);
    return res.status(204).end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("No active Spotify device") ? 404 : 502;
    return res.status(status).json({ error: message });
  }
}

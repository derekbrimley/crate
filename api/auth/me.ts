import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.json({ user: null });

  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      spotifyId: user.spotify_id,
    },
  });
}

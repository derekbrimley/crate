import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getUserByEmail, sendFriendRecommendation } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { email, album } = req.body ?? {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!album?.title || !album?.creator || !album?.external_id) {
    return res.status(400).json({ error: "Album title, creator, and external_id are required" });
  }

  const recipient = await getUserByEmail(email);
  if (!recipient) {
    return res.status(404).json({ error: "No user found with that email" });
  }

  if (recipient.id === user.id) {
    return res.status(400).json({ error: "You can't send a recommendation to yourself" });
  }

  const recommendation = await sendFriendRecommendation(
    user.id,
    user.display_name,
    user.email,
    recipient.id,
    {
      title: album.title,
      creator: album.creator,
      image_url: album.image_url ?? null,
      external_id: album.external_id,
      external_uri: album.external_uri ?? null,
      external_url: album.external_url ?? null,
    }
  );

  res.json({ recommendation });
}

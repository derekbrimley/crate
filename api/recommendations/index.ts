import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import {
  getUserByEmail,
  sendFriendRecommendation,
  getPendingFriendRecommendations,
  updateFriendRecommendationStatus,
  addItem,
} from "../../lib/queries";
import { sendRecNotificationEmail } from "../../lib/email";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const recommendations = await getPendingFriendRecommendations(user.id);
    return res.json({ recommendations });
  }

  if (req.method === "POST") {
    const { action } = req.body ?? {};

    if (action === "send") {
      const { email, album } = req.body;

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

      sendRecNotificationEmail(
        recipient.email,
        user.display_name || "A friend",
        album.title,
        album.creator
      ).catch(() => {});

      return res.json({ recommendation });
    }

    if (action === "accept" || action === "dismiss") {
      const { rec_id } = req.body;
      const id = Number(rec_id);
      if (!id || isNaN(id)) {
        return res.status(400).json({ error: "rec_id is required" });
      }

      if (action === "accept") {
        const recs = await getPendingFriendRecommendations(user.id, 100);
        const rec = recs.find((r) => r.id === id);
        if (!rec) return res.status(404).json({ error: "Recommendation not found" });

        await addItem(
          user.id,
          "favorite",
          rec.title,
          rec.creator,
          rec.image_url,
          rec.external_id,
          rec.external_uri,
          rec.external_url,
          rec.metadata
        );
      }

      await updateFriendRecommendationStatus(user.id, id, action);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Invalid action" });
  }

  return res.status(405).end();
}

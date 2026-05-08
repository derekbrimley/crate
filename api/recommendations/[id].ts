import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { addItem, updateFriendRecommendationStatus, getPendingFriendRecommendations } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid recommendation ID" });

  const { action } = req.body ?? {};
  if (action !== "accept" && action !== "dismiss") {
    return res.status(400).json({ error: "Action must be 'accept' or 'dismiss'" });
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
  res.json({ ok: true });
}

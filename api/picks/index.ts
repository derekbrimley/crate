import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { recordPick } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { item_id, mode, context } = req.body as {
    item_id: number;
    mode: string;
    context?: string;
  };

  if (!item_id || !mode) {
    return res.status(400).json({ error: "Missing item_id or mode" });
  }

  const pick = await recordPick(user.id, item_id, mode, context ?? null);
  res.json({ pick });
}

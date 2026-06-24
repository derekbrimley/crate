import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { recordPick, getPickHistory } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const history = await getPickHistory(user.id, limit, offset);
    return res.json({ history });
  }

  if (req.method === "POST") {
    const { item_id, mode, context } = req.body as {
      item_id: number;
      mode: string;
      context?: string;
    };

    if (!item_id || !mode) {
      return res.status(400).json({ error: "Missing item_id or mode" });
    }

    const pick = await recordPick(user.id, item_id, mode, context ?? null);
    return res.json({ pick });
  }

  res.status(405).end();
}

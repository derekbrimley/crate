import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getPickHistory } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const offset = parseInt((req.query.offset as string) || "0", 10);

  const history = await getPickHistory(user.id, limit, offset);
  res.json({ history });
}

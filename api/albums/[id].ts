import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { deleteItem } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") return res.status(405).end();

  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await deleteItem(user.id, id);
  res.json({ ok: true });
}

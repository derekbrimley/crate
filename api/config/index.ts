import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../../lib/auth";
import { getAllConfig, setConfig } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getAuthenticatedUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const config = await getAllConfig(user.id);
    return res.json({ config });
  }

  if (req.method === "PATCH") {
    const updates = req.body as Record<string, unknown>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) => setConfig(user.id, key, value))
    );
    const config = await getAllConfig(user.id);
    return res.json({ config });
  }

  res.status(405).end();
}

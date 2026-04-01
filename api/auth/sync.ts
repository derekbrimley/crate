import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { upsertUser, saveSpotifyTokens } from "../../lib/queries";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: "No token" });

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  const spotifyIdentity = user.identities?.find((i) => i.provider === "spotify");
  const spotifyId = spotifyIdentity?.identity_data?.provider_id as string | undefined;
  const displayName = (spotifyIdentity?.identity_data?.name as string) ?? null;
  const email = user.email ?? null;

  await upsertUser(user.id, displayName, email);

  const { provider_token, provider_refresh_token } = req.body as {
    provider_token?: string;
    provider_refresh_token?: string;
  };

  if (spotifyId && provider_token) {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await saveSpotifyTokens(
      user.id,
      spotifyId,
      displayName,
      provider_token,
      provider_refresh_token ?? "",
      expiresAt
    );
  }

  res.json({ ok: true });
}

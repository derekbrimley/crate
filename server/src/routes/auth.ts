import { Router } from "express";
import crypto from "crypto";
import { upsertUser, getUserById } from "../db/queries";

const router = Router();

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// GET /api/auth/login — redirect to Spotify
router.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  res.redirect(`${SPOTIFY_AUTH_URL}?${params}`);
});

// GET /api/auth/callback — Spotify redirects here
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${process.env.CLIENT_URL}?error=${encodeURIComponent(error)}`);
    return;
  }

  if (state !== req.session.oauthState) {
    res.status(400).json({ error: "State mismatch" });
    return;
  }

  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    res.status(400).json({ error: "Missing code verifier" });
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Fetch user profile
    const profileRes = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      id: string;
      display_name: string;
      email: string;
    };

    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
    const user = upsertUser(
      profile.id,
      profile.display_name,
      profile.email,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt
    );

    req.session.userId = user.id;
    delete req.session.oauthState;
    delete req.session.codeVerifier;

    res.redirect(process.env.CLIENT_URL!);
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect(`${process.env.CLIENT_URL}?error=auth_failed`);
  }
});

// GET /api/auth/me — get current user
router.get("/me", (req, res) => {
  if (!req.session?.userId) {
    res.json({ user: null });
    return;
  }
  const user = getUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      spotifyId: user.spotify_id,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;

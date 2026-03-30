import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { User } from "../types";

async function syncUser(session: Session): Promise<void> {
  if (!session.provider_token) return;
  await fetch("/api/auth/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      provider_token: session.provider_token,
      provider_refresh_token: session.provider_refresh_token,
    }),
  });
}

function mapUser(supabaseUser: NonNullable<Session["user"]>): User {
  const identity = supabaseUser.identities?.find((i) => i.provider === "spotify");
  return {
    id: 0, // not used client-side
    displayName: (identity?.identity_data?.name as string) ?? null,
    email: supabaseUser.email ?? null,
    spotifyId: (identity?.identity_data?.provider_id as string) ?? "",
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await syncUser(session);
        setUser(mapUser(session.user));
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        await syncUser(session);
        setUser(mapUser(session.user));
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = () => {
    supabase.auth.signInWithOAuth({
      provider: "spotify",
      options: {
        scopes:
          "user-library-read playlist-read-private playlist-read-collaborative",
        redirectTo: `${window.location.origin}/callback`,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, login, logout };
}

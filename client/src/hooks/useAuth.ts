import { useState, useEffect } from "react";
import { getMe, logout as apiLogout, getLoginUrl } from "../services/api";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    window.location.href = getLoginUrl();
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return { user, loading, login, logout };
}

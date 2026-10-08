import { useCallback, useState } from "react";

// "paper" is the high-contrast black-on-white theme for monochrome reflective
// screens. The choice is per device (localStorage), since that's what decides
// which theme reads well. index.html applies it before first paint; keep the
// storage key and theme-color values in sync with the script there.
export type Theme = "neon" | "paper";

const STORAGE_KEY = "crate-theme";
const THEME_COLORS: Record<Theme, string> = { neon: "#09070a", paper: "#ffffff" };

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "paper" ? "paper" : "neon";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "paper") root.dataset.theme = "paper";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked — the theme still applies for this session.
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);
  const toggleTheme = useCallback(() => setTheme(getTheme() === "paper" ? "neon" : "paper"), [setTheme]);
  return { theme, setTheme, toggleTheme };
}

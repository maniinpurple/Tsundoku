import type { Theme } from "../../core/settings";

const KEY = "tsundoku-theme";

// Also kept in localStorage so the popup opens in the right colors before settings load.
export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
}

export function applyCachedTheme() {
  try {
    const theme = localStorage.getItem(KEY);
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch {}
}

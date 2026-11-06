export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "prumo-theme";

// Run before paint so a saved dark theme never flashes the light canvas.
export const themeBootScript = `(()=>{var r=document.documentElement;var t="light";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");t=s==="dark"||s==="light"?s:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch{}r.dataset.theme=t;r.style.colorScheme=t;})();`;

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme still works when browser storage is unavailable.
  }
}

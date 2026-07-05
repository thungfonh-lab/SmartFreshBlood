export type Theme = "light" | "dark";

const THEME_KEY = "sfb-theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_KEY, theme);
}

/** เรียกครั้งเดียวตอน mount ฝั่ง client — ใช้ค่าที่จำไว้ หรือ preference ของระบบถ้ายังไม่เคยตั้ง */
export function initTheme(): void {
  if (typeof window === "undefined") return;
  const stored = getStoredTheme();
  const theme: Theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
}

export function getCurrentTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** สคริปต์ inline สำหรับวางใน <head> กันหน้าจอกะพริบสีผิดก่อน React hydrate */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

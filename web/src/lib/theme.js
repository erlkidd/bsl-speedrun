// Тема оформления: светлая / тёмная. Выбор хранится в браузере; до первого выбора — как в системе.
import { useSyncExternalStore } from "react";

const KEY = "bsl-speedrun:theme";
const subs = new Set();
const root = document.documentElement;
export const getTheme = () => (root.dataset.theme === "dark" ? "dark" : "light");
export const isDark = () => getTheme() === "dark";
export function setTheme(theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* приватный режим */ }
  subs.forEach((f) => f());
}
export const toggleTheme = () => setTheme(isDark() ? "light" : "dark");
export const onTheme = (f) => { subs.add(f); return () => subs.delete(f); };
export const useTheme = () => useSyncExternalStore(onTheme, getTheme, () => "light");

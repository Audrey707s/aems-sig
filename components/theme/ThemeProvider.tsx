"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { readThemeMode, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({mode: "system", setMode: () => {}});
export function ThemeProvider({children}: {children: ReactNode}) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let current: ThemeMode = "system";
    const apply = (value: ThemeMode) => {
      current = value; setMode(value);
      const resolved = resolveTheme(value, media.matches);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    try { apply(readThemeMode(localStorage.getItem(THEME_STORAGE_KEY))); } catch { apply("system"); }
    const systemChanged = () => apply(current);
    const stored = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key === null) apply(readThemeMode(event.newValue)); };
    const selected = (event: Event) => apply((event as CustomEvent<ThemeMode>).detail);
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", stored);
    window.addEventListener("aems-theme", selected);
    return () => { media.removeEventListener("change", systemChanged); window.removeEventListener("storage", stored); window.removeEventListener("aems-theme", selected); };
  }, []);
  function changeMode(value: ThemeMode) {
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Keep the selection for this tab when storage is blocked. */ }
    window.dispatchEvent(new CustomEvent("aems-theme", {detail: value}));
  }
  return <ThemeContext.Provider value={{mode, setMode: changeMode}}>{children}</ThemeContext.Provider>;
}
export function ThemeSwitcher() {
  const {mode, setMode} = useContext(ThemeContext);
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  return <label className="theme-switcher inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs">
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="sr-only">Tema tampilan</span>
    <select aria-label="Tema tampilan" value={mode} onChange={event => setMode(readThemeMode(event.target.value))} className="min-w-0 bg-transparent text-xs outline-none">
      <option value="light">Terang</option><option value="dark">Gelap</option><option value="system">Sistem</option>
    </select>
  </label>;
}

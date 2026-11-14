export type ThemeMode = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "aems.theme.v1";
export function readThemeMode(value: string | null): ThemeMode {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(mode: ThemeMode, systemDark: boolean): "light" | "dark" {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}
// Runs before paint. Storage may be blocked in private/restricted browsers.
export const themeBootstrap = `(function(){var m='system';try{var v=localStorage.getItem('${THEME_STORAGE_KEY}');if(v==='light'||v==='dark')m=v}catch(e){}var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'})()`;

import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { readThemeMode, resolveTheme, themeBootstrap } from "@/lib/theme";
describe("theme preference", () => {
  it("uses system mode for missing or obsolete preferences", () => {
    expect(readThemeMode(null)).toBe("system"); expect(readThemeMode("unknown")).toBe("system");
    expect(readThemeMode("dark")).toBe("dark"); expect(readThemeMode("light")).toBe("light");
  });
  it("follows the OS only when system mode is selected", () => {
    expect(resolveTheme("system", true)).toBe("dark"); expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light"); expect(resolveTheme("dark", false)).toBe("dark");
  });
  it.each([["dark", false, "dark"], ["light", true, "light"], [null, true, "dark"]])("applies %s before paint", (stored, system, expected) => {
    const root = {dataset: {}, style: {}};
    runInNewContext(themeBootstrap, {document: {documentElement: root}, localStorage: {getItem: () => stored}, matchMedia: () => ({matches: system})});
    expect(root.dataset).toEqual({theme: expected}); expect(root.style).toEqual({colorScheme: expected});
  });
  it("still boots when browser storage is unavailable", () => {
    const root = {dataset: {}, style: {}};
    runInNewContext(themeBootstrap, {document: {documentElement: root}, localStorage: {getItem: () => {throw new Error("blocked");}}, matchMedia: () => ({matches: true})});
    expect(root.dataset).toEqual({theme: "dark"});
  });
});

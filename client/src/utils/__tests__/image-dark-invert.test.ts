import { describe, it, expect } from "bun:test";
import {
  shouldInvertImageInDarkMode,
  darkInvertImageClass,
} from "../image-dark-invert";

describe("shouldInvertImageInDarkMode", () => {
  it("returns true for .svg URLs", () => {
    expect(shouldInvertImageInDarkMode("https://img.example.com/logo.svg")).toBe(true);
    expect(shouldInvertImageInDarkMode("logo.svg")).toBe(true);
    expect(shouldInvertImageInDarkMode("/images/a.b.svg")).toBe(true);
  });

  it("is case-insensitive for the .svg extension", () => {
    expect(shouldInvertImageInDarkMode("https://img.example.com/LOGO.SVG")).toBe(true);
  });

  it("ignores query strings and hash metadata when detecting the extension", () => {
    expect(shouldInvertImageInDarkMode("https://img.example.com/logo.svg?v=2")).toBe(true);
    expect(
      shouldInvertImageInDarkMode("https://img.example.com/logo.svg#blurhash=abc&width=10&height=10"),
    ).toBe(true);
  });

  it("returns true for svg data URIs", () => {
    expect(
      shouldInvertImageInDarkMode("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iLyoqLyI+"),
    ).toBe(true);
    expect(
      shouldInvertImageInDarkMode("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    ).toBe(true);
  });

  it("returns false for non-SVG sources", () => {
    expect(shouldInvertImageInDarkMode("https://img.example.com/logo.png")).toBe(false);
    expect(shouldInvertImageInDarkMode("https://img.example.com/avatar.webp")).toBe(false);
    expect(shouldInvertImageInDarkMode("data:image/png;base64,iVBOR")).toBe(false);
    expect(shouldInvertImageInDarkMode("https://img.example.com/logo.svg.png")).toBe(false);
  });

  it("returns false for empty or missing sources", () => {
    expect(shouldInvertImageInDarkMode(undefined)).toBe(false);
    expect(shouldInvertImageInDarkMode(null)).toBe(false);
    expect(shouldInvertImageInDarkMode("")).toBe(false);
    expect(shouldInvertImageInDarkMode("   ")).toBe(false);
  });

  it("respects the #no-invert opt-out flag", () => {
    expect(shouldInvertImageInDarkMode("https://img.example.com/logo.svg#no-invert")).toBe(false);
    expect(
      shouldInvertImageInDarkMode("https://img.example.com/logo.svg#blurhash=abc&no-invert"),
    ).toBe(false);
    expect(
      shouldInvertImageInDarkMode("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iLyoqLyI+#no-invert"),
    ).toBe(false);
  });
});

describe("darkInvertImageClass", () => {
  it("returns dark:invert for SVG sources", () => {
    expect(darkInvertImageClass("https://img.example.com/logo.svg")).toBe("dark:invert");
  });

  it("returns an empty string otherwise", () => {
    expect(darkInvertImageClass("https://img.example.com/logo.png")).toBe("");
    expect(darkInvertImageClass(undefined)).toBe("");
  });
});

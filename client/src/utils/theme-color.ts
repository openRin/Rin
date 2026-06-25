const DEFAULT_THEME_COLOR = "#35bfab";

function normalizeHex(value: string | undefined | null) {
  if (!value) return DEFAULT_THEME_COLOR;
  const trimmed = value.trim();

  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const expanded = short[1]
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded}`.toLowerCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return DEFAULT_THEME_COLOR;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function themeColorToRgb(value: string | undefined | null) {
  return hexToRgb(normalizeHex(value));
}

function mix(value: number, target: number, ratio: number) {
  return Math.round(value + (target - value) * ratio);
}

function shade(hex: string, ratio: number) {
  const { r, g, b } = hexToRgb(hex);
  const target = ratio < 0 ? 0 : 255;
  const amount = Math.abs(ratio);

  return {
    r: mix(r, target, amount),
    g: mix(g, target, amount),
    b: mix(b, target, amount),
  };
}

function toCssRgb({ r, g, b }: { r: number; g: number; b: number }) {
  return `${r} ${g} ${b}`;
}

export function normalizeThemeColor(value: string | undefined | null) {
  return normalizeHex(value);
}

export function applyThemeColor(value: string | undefined | null) {
  const color = normalizeHex(value);
  const root = document.documentElement;

  root.style.setProperty("--theme-rgb", toCssRgb(hexToRgb(color)));
  root.style.setProperty("--theme-hover-rgb", toCssRgb(shade(color, -0.3)));
  root.style.setProperty("--theme-active-rgb", toCssRgb(shade(color, -0.4)));
}

// Advanced theme color palette — inspired by 2025-blog
export type ThemePalette = {
  brand: string;
  brandSecondary: string;
  primary: string;
  secondary: string;
  bg: string;
  card: string;
  article: string;
};

export const DEFAULT_THEME_PALETTE: ThemePalette = {
  brand: "#35bfab",
  brandSecondary: "#1fc9e7",
  primary: "#334f52",
  secondary: "#7b888e",
  bg: "#eeeeee",
  card: "rgba(255, 255, 255, 0.4)",
  article: "rgba(255, 255, 255, 0.8)",
};

export function applyThemePalette(palette: Partial<ThemePalette>) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_THEME_PALETTE, ...palette };

  root.style.setProperty("--theme-brand", merged.brand);
  root.style.setProperty("--theme-brand-secondary", merged.brandSecondary);
  root.style.setProperty("--theme-primary", merged.primary);
  root.style.setProperty("--theme-secondary", merged.secondary);
  root.style.setProperty("--theme-bg", merged.bg);
  root.style.setProperty("--theme-card", merged.card);
  root.style.setProperty("--theme-article", merged.article);
}

export function clearThemePalette() {
  const root = document.documentElement;
  const vars = [
    "--theme-brand",
    "--theme-brand-secondary",
    "--theme-primary",
    "--theme-secondary",
    "--theme-bg",
    "--theme-card",
    "--theme-article",
  ];
  for (const v of vars) {
    root.style.removeProperty(v);
  }
}

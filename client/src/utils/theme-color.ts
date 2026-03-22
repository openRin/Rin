const DEFAULT_THEME_COLOR = "#fc466b";

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

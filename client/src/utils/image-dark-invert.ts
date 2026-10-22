const NO_INVERT_FLAG = "no-invert";

/**
 * Monochrome SVG logos are unreadable on dark backgrounds. Detect SVG sources
 * (URL or data URI) so callers can apply `dark:invert` in dark mode.
 *
 * Opt out by appending `#no-invert` to the URL, mirroring the existing
 * `#blurhash=` URL-fragment metadata convention.
 */
export function shouldInvertImageInDarkMode(src?: string | null): boolean {
  if (!src) {
    return false;
  }

  const [baseUrl = "", fragment = ""] = src.split("#", 2);
  if (fragment === NO_INVERT_FLAG || new URLSearchParams(fragment).has(NO_INVERT_FLAG)) {
    return false;
  }

  const [path = ""] = baseUrl.split("?", 2);
  const normalized = path.trim().toLowerCase();
  if (normalized.startsWith("data:image/svg+xml")) {
    return true;
  }
  return normalized.endsWith(".svg");
}

/**
 * Tailwind class that inverts the image in dark mode when `src` is an SVG.
 */
export function darkInvertImageClass(src?: string | null): string {
  return shouldInvertImageInDarkMode(src) ? "dark:invert" : "";
}

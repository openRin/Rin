export const DEFAULT_LOGIN_REDIRECT = "/";
export const HIDDEN_LOGIN_REDIRECT = "/admin/writing";

export function buildLoginPath(redirectTo?: string): string {
  const safeRedirect = sanitizeRedirectPath(redirectTo);

  if (!safeRedirect || safeRedirect === DEFAULT_LOGIN_REDIRECT) {
    return "/login";
  }

  return `/login?redirect=${encodeURIComponent(safeRedirect)}`;
}

export function getLoginRedirectPath(search: string): string {
  const redirect = new URLSearchParams(search).get("redirect");
  return sanitizeRedirectPath(redirect) ?? DEFAULT_LOGIN_REDIRECT;
}

function sanitizeRedirectPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path;
}

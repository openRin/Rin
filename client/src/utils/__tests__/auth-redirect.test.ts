import { describe, expect, it } from "vitest";
import {
  buildLoginPath,
  DEFAULT_LOGIN_REDIRECT,
  getLoginRedirectPath,
  HIDDEN_LOGIN_REDIRECT,
} from "../auth-redirect";

describe("auth redirect helpers", () => {
  it("builds a login path with a safe redirect", () => {
    expect(buildLoginPath(HIDDEN_LOGIN_REDIRECT)).toBe("/login?redirect=%2Fadmin%2Fwriting");
  });

  it("omits the redirect query for the default destination", () => {
    expect(buildLoginPath(DEFAULT_LOGIN_REDIRECT)).toBe("/login");
  });

  it("falls back to the default destination for unsafe redirects", () => {
    expect(getLoginRedirectPath("?redirect=https://example.com")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(getLoginRedirectPath("?redirect=//example.com")).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  it("returns a safe in-app redirect", () => {
    expect(getLoginRedirectPath("?redirect=%2Fadmin%2Fwriting")).toBe(HIDDEN_LOGIN_REDIRECT);
  });
});

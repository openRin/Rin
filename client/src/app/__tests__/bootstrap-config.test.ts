import { afterEach, describe, expect, it } from "vitest";
import { readBootstrappedClientConfig } from "../bootstrap-config";

describe("readBootstrappedClientConfig", () => {
  afterEach(() => {
    delete (window as Window & { __RIN_CLIENT_CONFIG__?: Record<string, unknown> }).__RIN_CLIENT_CONFIG__;
  });

  it("returns the inline bootstrap config from window", () => {
    (window as Window & { __RIN_CLIENT_CONFIG__?: Record<string, unknown> }).__RIN_CLIENT_CONFIG__ = {
      "site.name": "Rin",
      "theme.color": "#fc466b",
    };

    expect(readBootstrappedClientConfig()).toEqual({
      "site.name": "Rin",
      "theme.color": "#fc466b",
    });
  });

  it("returns null when no bootstrap config is present", () => {
    expect(readBootstrappedClientConfig()).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { readBootstrappedClientConfig } from "../bootstrap-config";

type GlobalWithClientConfig = typeof globalThis & {
  __RIN_CLIENT_CONFIG__?: Record<string, unknown>;
};

describe("readBootstrappedClientConfig", () => {
  afterEach(() => {
    delete (globalThis as GlobalWithClientConfig).__RIN_CLIENT_CONFIG__;
  });

  it("returns the inline bootstrap config from window", () => {
    (globalThis as GlobalWithClientConfig).__RIN_CLIENT_CONFIG__ = {
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

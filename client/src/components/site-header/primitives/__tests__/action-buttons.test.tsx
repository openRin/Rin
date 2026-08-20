import "../../../../test/setup";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { ConfigWrapper } from "../../../../state/config";
import { ClientConfigContext, defaultClientConfig } from "../../../../state/config";
import type { Profile } from "../../../../state/profile";
import { UserAvatar } from "../action-buttons";

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

mock.module("wouter", () => ({
  useLocation: () => ["/", mock()],
}));

mock.module("reactjs-popup", () => ({
  default: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

mock.module("react-modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

mock.module("../../../../app/runtime", () => ({
  client: {
    user: {
      logout: mock(),
    },
  },
}));

mock.module("../../../../utils/auth", () => ({
  removeAuthToken: mock(),
}));

afterEach(() => {
  cleanup();
});

function renderUserAvatar({
  loginEnabled,
  profile,
}: {
  loginEnabled: boolean;
  profile?: Profile | null;
}) {
  const config = new ConfigWrapper({ "login.enabled": loginEnabled }, defaultClientConfig);

  return render(
    <ClientConfigContext.Provider value={config}>
      <UserAvatar profile={profile} />
    </ClientConfigContext.Provider>,
  );
}

describe("UserAvatar", () => {
  it("hides the login entry when login is disabled and the user is signed out", () => {
    const { container } = renderUserAvatar({ loginEnabled: false, profile: null });

    expect(container.childElementCount).toBe(0);
  });

  it("shows the avatar menu when login is disabled but the user is signed in", () => {
    const { container } = renderUserAvatar({
      loginEnabled: false,
      profile: {
        id: 1,
        avatar: "",
        permission: true,
        name: "admin",
      },
    });

    expect(within(container).getByRole("button", { name: "profile.title" }).isConnected).toBe(true);
  });
});

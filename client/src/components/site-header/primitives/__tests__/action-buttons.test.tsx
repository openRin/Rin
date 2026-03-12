import "../../../../test/setup";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigWrapper } from "../../../../state/config";
import { ClientConfigContext, defaultClientConfig } from "../../../../state/config";
import type { Profile } from "../../../../state/profile";
import { UserAvatar } from "../action-buttons";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("reactjs-popup", () => ({
  default: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("react-modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../app/runtime", () => ({
  client: {
    user: {
      logout: vi.fn(),
    },
  },
}));

vi.mock("../../../../utils/auth", () => ({
  removeAuthToken: vi.fn(),
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

    expect(container).toBeEmptyDOMElement();
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

    expect(within(container).getByRole("button", { name: "profile.title" })).toBeInTheDocument();
  });
});

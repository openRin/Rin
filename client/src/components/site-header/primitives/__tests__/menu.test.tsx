import "../../../../test/setup";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Menu } from "../menu";

mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: mock(),
    },
  }),
}));

mock.module("wouter", () => ({
  useLocation: () => ["/", mock()],
}));

mock.module("reactjs-popup", () => ({
  default: ({
    trigger,
    open,
    children,
  }: {
    trigger: ReactNode;
    open?: boolean;
    children: ReactNode;
  }) => (
    <>
      {trigger}
      {open ? children : null}
    </>
  ),
}));

mock.module("react-modal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

mock.module("../../../app/runtime", () => ({
  client: {
    user: {
      logout: mock(),
    },
  },
}));

mock.module("../../../utils/auth", () => ({
  removeAuthToken: mock(),
}));

mock.module("../nav-bar", () => ({
  NavBar: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>navigate</button>,
}));

describe("Menu", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("restores body scroll when the menu closes", async () => {
    const { getByRole } = render(<Menu />);

    fireEvent.click(getByRole("button"));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    fireEvent.click(getByRole("button", { name: "navigate" }));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("restores body scroll when the menu unmounts during navigation", async () => {
    const { getByRole, unmount } = render(<Menu />);

    fireEvent.click(getByRole("button"));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();

    expect(document.body.style.overflow).toBe("");
  });
});

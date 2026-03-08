import "../../../../test/setup";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Menu } from "../menu";

let location = "/";

vi.mock("wouter", () => ({
  useLocation: () => [location, vi.fn()],
}));

vi.mock("reactjs-popup", () => ({
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

vi.mock("../action-buttons", () => ({
  LanguageSwitch: () => <div>language-switch</div>,
  SearchButton: ({ onClose }: { onClose?: () => void }) => <button onClick={onClose}>search</button>,
  UserAvatar: () => <div>user-avatar</div>,
}));

vi.mock("../nav-bar", () => ({
  NavBar: ({ onClick }: { onClick?: () => void }) => <button onClick={onClick}>navigate</button>,
}));

describe("Menu", () => {
  beforeEach(() => {
    location = "/";
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

  it("restores body scroll after a route change unmount path", async () => {
    const { getByRole, rerender } = render(<Menu />);

    fireEvent.click(getByRole("button"));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    location = "/timeline";
    rerender(<Menu />);

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("");
    });
  });
});

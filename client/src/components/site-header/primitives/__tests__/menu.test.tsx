import "../../../../test/setup";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Menu } from "../menu";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
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

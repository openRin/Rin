import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useTableOfContents from "../useTableOfContents";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

class MockIntersectionObserver {
  static latest: MockIntersectionObserver;

  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.latest = this;
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  trigger(entries: Array<Pick<IntersectionObserverEntry, "isIntersecting" | "target">>) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

function TableOfContentsHarness() {
  const { TOC } = useTableOfContents(".toc-content");

  return (
    <>
      <article className="toc-content">
        <h2>Introduction</h2>
        <h2>Details</h2>
        <h2>Conclusion</h2>
      </article>
      <aside>
        <TOC />
      </aside>
    </>
  );
}

describe("useTableOfContents", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("preserves the navigation scroll position when the active heading changes", async () => {
    render(<TableOfContentsHarness />);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    const tocList = screen.getByRole("list");
    tocList.scrollTop = 96;

    fireEvent.click(screen.getAllByRole("listitem")[1]);

    const headings = document.querySelectorAll<HTMLElement>(".toc-content h2");
    act(() => {
      MockIntersectionObserver.latest.trigger([
        { target: headings[2], isIntersecting: true },
      ]);
    });

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")[1]).toHaveClass("text-theme");
    });
    expect(screen.getByRole("list").scrollTop).toBe(96);
  });
});

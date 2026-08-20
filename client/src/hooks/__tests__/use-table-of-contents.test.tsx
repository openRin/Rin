import "../../test/setup";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useTableOfContents from "../useTableOfContents";

mock.module("react-i18next", () => ({
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

  disconnect = mock();
  observe = mock();
  takeRecords = mock(() => []);
  unobserve = mock();

  trigger(entries: Array<Pick<IntersectionObserverEntry, "isIntersecting" | "target">>) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

const originalIntersectionObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
const originalGetComputedStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
const originalReactActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalScrollTo = Object.getOwnPropertyDescriptor(window, "scrollTo");

function restoreGlobal(
  target: typeof globalThis | Window,
  key: "IntersectionObserver" | "getComputedStyle" | "IS_REACT_ACT_ENVIRONMENT" | "scrollTo",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
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
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver,
      writable: true,
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: window.getComputedStyle.bind(window),
      writable: true,
    });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
      writable: true,
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: mock(),
      writable: true,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restoreGlobal(globalThis, "IntersectionObserver", originalIntersectionObserver);
    restoreGlobal(globalThis, "getComputedStyle", originalGetComputedStyle);
    restoreGlobal(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalReactActEnvironment);
    restoreGlobal(window, "scrollTo", originalScrollTo);
  });

  it("preserves the navigation scroll position when the active heading changes", () => {
    act(() => root.render(<TableOfContentsHarness />));

    const getTocItems = () => Array.from(container.querySelectorAll<HTMLElement>("aside li"));
    expect(getTocItems()).toHaveLength(3);

    const tocList = container.querySelector<HTMLElement>("aside ul")!;
    tocList.scrollTop = 96;

    act(() => {
      getTocItems()[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    const headings = document.querySelectorAll<HTMLElement>(".toc-content h2");
    act(() => {
      MockIntersectionObserver.latest.trigger([
        { target: headings[2], isIntersecting: true },
      ]);
    });

    expect(getTocItems()[1].classList.contains("text-theme")).toBe(true);
    expect(container.querySelector<HTMLElement>("aside ul")!.scrollTop).toBe(96);
  });
});

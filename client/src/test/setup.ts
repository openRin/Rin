import { JSDOM } from "jsdom";

if (typeof document === "undefined") {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");

  Object.defineProperties(window.HTMLElement.prototype, {
    attachEvent: {
      configurable: true,
      value: () => undefined,
    },
    detachEvent: {
      configurable: true,
      value: () => undefined,
    },
  });

  Object.assign(globalThis, {
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLImageElement: window.HTMLImageElement,
    navigator: window.navigator,
    window,
  });
}

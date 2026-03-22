import { JSDOM } from "jsdom";
import '@testing-library/jest-dom'

if (typeof document === "undefined") {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");

  Object.assign(globalThis, {
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLImageElement: window.HTMLImageElement,
    navigator: window.navigator,
    window,
  });
}

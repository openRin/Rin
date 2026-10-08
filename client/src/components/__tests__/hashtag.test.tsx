import "../../test/setup";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { HashTag } from "../hashtag";

// HashTag 内部用 wouter 的 useLocation，需要浏览器的 location
beforeAll(() => {
  if (typeof (globalThis as any).location === "undefined") {
    (globalThis as any).location = { pathname: "/", search: "", hash: "" };
  }
});

afterEach(() => {
  cleanup();
});

/**
 * SettingsPreviewCard 用 <button> 包裹预览内容，若被包裹内容里再出现
 * <button>，就构成非法的 <button><button> 嵌套。浏览器会重写该 DOM，
 * 导致 React 虚拟 DOM 与真实 DOM 不一致，组件树崩塌，
 * hooks 失去渲染上下文并抛出
 * "Cannot read properties of null (reading 'useRef')"（仅生产构建暴露）。
 */
describe("HashTag", () => {
  it("renders an interactive button by default", () => {
    const { container } = render(<HashTag name="design" />);
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("renders a span instead of a button when interactive is false", () => {
    const { container } = render(<HashTag name="design" interactive={false} />);

    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("span")).not.toBeNull();
    expect(container.textContent).toContain("design");
  });

  it("produces no nested button when rendered inside a button wrapper", () => {
    const { container } = render(
      //模拟 SettingsPreviewCard 的 <button> 包裹场景
      <button type="button">
        <HashTag name="design" interactive={false} />
      </button>,
    );

    expect(container.querySelectorAll("button").length).toBe(1);
  });
});

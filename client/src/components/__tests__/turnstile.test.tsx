import "../../test/setup";
import { cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TurnstileWidget, resetTurnstile } from "../turnstile";

// 照 admin-plugins.test.tsx 的做法：mock react-i18next，
// 让断言聚焦组件行为而不是翻译内容
mock.module("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Turnstile 组件的渲染行为测试。
 * 回归真实 bug：旧实现用 widgetIdRef 去重，「挂载→清理→再挂载」时会把
 * 「已渲染」误判成「已存在」而永不重建；修复后改用 DOM 里的 iframe 作判据。
 */
describe("TurnstileWidget", () => {
  let renderCount = 0;
  let removedIds: string[] = [];
  let options: Record<string, unknown> | undefined;
  let iframesById: Map<string, HTMLIFrameElement>;

  beforeEach(() => {
    renderCount = 0;
    removedIds = [];
    options = undefined;
    iframesById = new Map();

    // 伪造 Turnstile 全局，模拟往容器插 iframe 的副作用（「widget 是否存在」的判据）。
    // fake 必须像真实 API 一样校验参数：fake 宽松 = 测试形同虚设。
    // 注意：只赋值 turnstile，不要展开整个 window —— jsdom 惰性 getter 展开会触发 SecurityError。
    (globalThis as unknown as { window: Record<string, unknown> }).window.turnstile = {
      render(target: HTMLElement, opts: Record<string, unknown>) {
        // 复刻真实 API 的参数校验
        const ALLOWED_APPEARANCE = ["always", "execute", "interaction-only"];
        if (opts.appearance !== undefined && !ALLOWED_APPEARANCE.includes(String(opts.appearance))) {
          throw new Error(
            `[Cloudflare Turnstile] Unknown appearance value: "${opts.appearance}", ` +
              `expected either: 'always', 'execute', or 'interaction-only'.`,
          );
        }
        if (!opts.sitekey) {
          throw new Error("[Cloudflare Turnstile] sitekey is required");
        }

        renderCount += 1;
        options = opts;

        // 记录这次渲染对应的 iframe，以便 remove 时能精确移除
        const iframe = document.createElement("iframe");
        iframe.dataset.widgetId = `widget-${renderCount}`;
        target.appendChild(iframe);
        iframesById.set(`widget-${renderCount}`, iframe);

        return `widget-${renderCount}`;
      },
      reset() {
        /* noop */
      },
      remove(id: string) {
        removedIds.push(id);
        // 必须真的移除，否则会在「remove 后 iframe 残留」的错误前提下通过
        iframesById.get(id)?.remove();
        iframesById.delete(id);
      },
    };
  });

  afterEach(() => {
    cleanup();
    delete (globalThis as unknown as { window: { turnstile?: unknown } }).window.turnstile;
  });

  it("renders the widget so an iframe appears", async () => {
    const { container } = render(
      <TurnstileWidget siteKey="site-key-123" onToken={() => {}} action="register" />,
    );

    await waitFor(() => {
      expect(container.querySelector("iframe")).not.toBeNull();
    });
    expect(renderCount).toBe(1);
  });

  it("still renders under StrictMode double-invocation", async () => {
    // 核心回归：StrictMode 下 effect 跑两遍，旧判据会让 widget 永久不出现；
    // testing-library 默认不包 StrictMode，必须显式包才能复现。
    const { container } = render(
      <StrictMode>
        <TurnstileWidget siteKey="site-key-123" onToken={() => {}} action="register" />
      </StrictMode>,
    );

    // 不管 effect 跑几遍，最终 DOM 里必须存在可用的 widget
    await waitFor(() => {
      expect(container.querySelector("iframe")).not.toBeNull();
    });

    // 且不能留下重复渲染的残留
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("passes site key, action and theme through to Turnstile", async () => {
    render(
      <TurnstileWidget
        siteKey="site-key-abc"
        onToken={() => {}}
        action="comment"
        theme="dark"
      />,
    );

    await waitFor(() => expect(options).toBeDefined());

    expect(options?.sitekey).toBe("site-key-abc");
    expect(options?.action).toBe("comment");
    expect(options?.theme).toBe("dark");
    // 回归：曾把 appearance 写成 'explicit'（非法值），断言合法集合而不是硬编码具体值
    expect(["always", "execute", "interaction-only"]).toContain(options?.appearance);
  });

  it("reports an error when no site key is provided", async () => {
    let errored = false;
    render(
      <TurnstileWidget
        siteKey=""
        onToken={() => {}}
        onError={() => {
          errored = true;
        }}
      />,
    );

    await waitFor(() => expect(errored).toBe(true));
  });

  it("does not rebuild the widget when only the callback changes", async () => {
    // 父组件每次渲染都会传新的内联函数，若把它放进依赖会导致 widget 被反复重建，
    // 用户会看到验证码反复重置
    const { container, rerender } = render(
      <TurnstileWidget siteKey="site-key" onToken={() => {}} />,
    );

    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

    rerender(<TurnstileWidget siteKey="site-key" onToken={() => {}} />);

    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(renderCount).toBe(1);
  });

  it("reappears after unmount and remount", async () => {
    // 关键回归：cleanup 会 remove 并清空句柄，若判据仍认为「已存在」，widget 就永久丢失。
    const first = render(<TurnstileWidget siteKey="site-key" onToken={() => {}} />);

    await waitFor(() => expect(first.container.querySelector("iframe")).not.toBeNull());
    first.unmount();
    cleanup();

    const second = render(<TurnstileWidget siteKey="site-key" onToken={() => {}} />);

    // 第二次挂载必须能重新渲染出 iframe
    await waitFor(() => {
      expect(second.container.querySelector("iframe")).not.toBeNull();
    });
    expect(renderCount).toBe(2);
  });

  it("renders again after the site key changes", async () => {
    // 切到另一个 widget（换 site key）时必须重建，而不是沿用旧 widget
    const { container, rerender } = render(
      <TurnstileWidget siteKey="site-key-a" onToken={() => {}} />,
    );

    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

    rerender(<TurnstileWidget siteKey="site-key-b" onToken={() => {}} />);

    await waitFor(() => {
      expect(renderCount).toBe(2);
    });
    // 第二个 widget 拿到的是新 site key
    expect(options?.sitekey).toBe("site-key-b");
  });

  it("removes the widget on unmount", async () => {
    const { unmount } = render(<TurnstileWidget siteKey="site-key" onToken={() => {}} />);

    await waitFor(() => expect(removedIds.length).toBeGreaterThanOrEqual(0));
    unmount();

    // 卸载时清理，避免 iframe 残留
    expect(removedIds.length).toBe(1);
  });

  it("resetTurnstile is safe with a null element", () => {
    // 验证码失败时容器可能还没挂载，不应抛错
    expect(() => resetTurnstile(null)).not.toThrow();
    expect(() => resetTurnstile(undefined)).not.toThrow();
  });

  it("resetTurnstile delegates to the underlying reset", async () => {
    let resetCount = 0;
    (
      globalThis as unknown as {
        window: { turnstile: { reset: () => void } };
      }
    ).window.turnstile.reset = () => {
      resetCount += 1;
    };

    const { container } = render(
      <TurnstileWidget siteKey="site-key" onToken={() => {}} />,
    );

    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());

    resetTurnstile(container.querySelector("div"));

    expect(resetCount).toBe(1);
  });
});

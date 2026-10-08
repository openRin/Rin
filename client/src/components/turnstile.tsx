import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Cloudflare Turnstile 组件。
 * 脚本按需加载；用 `render=explicit` 手动渲染，幂等判断以 DOM 里的 iframe 为准
 * （StrictMode 下 effect 会跑两遍，widgetId 句柄可能与之脱节）。
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          action?: string;
          theme?: 'auto' | 'light' | 'dark';
          /**
           * 合法值只有 'always' | 'execute' | 'interaction-only'。
           * `'explicit'` 是脚本 URL 的 `?render=` 参数，别混用 —— 传错会导致渲染失败。
           */
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_BASE = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_SRC = `${SCRIPT_BASE}?render=explicit`;

let scriptPromise: Promise<void> | null = null;

/**
 * 加载 Turnstile 脚本。全局只注入一次。
 * 失败时清空缓存，让后续重试能重新注入。
 */
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_BASE}"]`);

    // 已有脚本但可能仍在加载中，挂回调等待其完成。
    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Turnstile script')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Turnstile script')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  // 失败时清空缓存，否则后续所有重试都会立刻拿到同一个 rejected promise
  promise.catch(() => {
    if (scriptPromise === promise) {
      scriptPromise = null;
    }
  });

  scriptPromise = promise;
  return promise;
}

export type TurnstileWidgetProps = {
  siteKey: string;
  /** 验证通过回调，参数是可用于服务端校验的 token */
  onToken: (token: string) => void;
  /** token 过期（Turnstile token 有 TTL） */
  onExpire?: () => void;
  /** widget 内部报错或脚本加载失败 */
  onError?: () => void;
  /** 传给 Cloudflare 的 action 名，便于后台按用途统计 */
  action?: string;
  theme?: 'auto' | 'light' | 'dark';
  className?: string;
};

export function TurnstileWidget({
  siteKey,
  onToken,
  onExpire,
  onError,
  action,
  theme = 'auto',
  className,
}: TurnstileWidgetProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 仅在「确实需要重置」时使用，不参与渲染去重判断
  const widgetIdRef = useRef<string | null>(null);
  // 当前 DOM 里已渲染的 widget 对应的 siteKey，用于判断是否需要重建
  const renderedKeyRef = useRef<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  /** 移除当前 widget 并清空状态。重复调用安全。 */
  function clearWidget() {
    if (widgetIdRef.current !== null && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // widget 可能已被浏览器回收
      }
      widgetIdRef.current = null;
    }

    // 兜底清空 DOM：没有句柄时（脚本尚未就绪、或 remove 失败）
    // 残留的 iframe 会让下一次渲染的幂等判断误判
    containerRef.current?.replaceChildren();
    renderedKeyRef.current = null;
  }

  // cleanup 回调里直接用 ref 指向的实现，避免闭包捕获到过期的 ref
  const clearWidgetRef = useRef(clearWidget);
  clearWidgetRef.current = clearWidget;

  // 用 ref 保存回调，避免父组件重渲染导致依赖变化而重建 widget
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  // 强制验证场景必须用 'always' 让 widget 显式可见；
  // 'interaction-only' 几乎不可见，用户会以为没有验证码，不适合注册页。
  const appearance = 'always';

  useEffect(() => {
    if (!siteKey) {
      onErrorRef.current?.();
      return;
    }

    let disposed = false;

    const renderWidget = () => {
      if (disposed) return;

      const container = containerRef.current;
      if (!container || !window.turnstile) return;

      // 幂等判断以「这个 siteKey 是否已渲染」为准：只看 widgetIdRef 会在
      // StrictMode 下被清空句柄误判，只看 iframe 又会漏掉 siteKey 变更。
      if (renderedKeyRef.current === siteKey && container.querySelector('iframe')) {
        return;
      }

      // siteKey 变了（或残留了别的 widget），先清干净再渲染
      if (renderedKeyRef.current !== siteKey) {
        clearWidget();
      }

      try {
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          action,
          theme,
          appearance,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onErrorRef.current?.(),
        });
        renderedKeyRef.current = siteKey;
      } catch (error) {
        console.error('[turnstile] render failed', error);
        onErrorRef.current?.();
      }
    };

    loadTurnstileScript()
      .then(renderWidget)
      .catch((error) => {
        if (disposed) return;
        console.error('[turnstile] script load failed', error);
        setLoadFailed(true);
        onErrorRef.current?.();
      });

    return () => {
      disposed = true;
      // 刻意不 remove widget：StrictMode 下 cleanup 后会立刻重挂载，
      // 若在这里 remove 会导致 widget 被移除且不再重建。卸载清理由下面的 useEffect 负责。
    };
  }, [siteKey, action, theme]);

  // 真正的卸载清理：此时不会再重挂载，可以放心移除
  useEffect(() => {
    // clearWidget 依赖 containerRef 的当前值，用 ref 兜住避免闭包读到旧值
    return () => clearWidgetRef.current();
  }, []);

  // 组件卸载后 ref 会变成 null，这里提前把重置方法挂到节点上供调用方使用
  const attachRef = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) {
      (node as HTMLDivElement & { __turnstileReset?: () => void }).__turnstileReset = () => {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      };
    }
  };

  if (loadFailed) {
    return (
      <div className={className}>
        <p className="text-sm text-red-500">
          {t('turnstile.load_failed')}
        </p>
      </div>
    );
  }

  return <div ref={attachRef} className={className} data-sitekey={siteKey} />;
}

/**
 * 命令式重置：验证码校验失败后必须调用，否则用户无法重试。
 */
export function resetTurnstile(element: HTMLElement | null | undefined) {
  if (!element) return;
  const withReset = element as HTMLDivElement & { __turnstileReset?: () => void };
  withReset.__turnstileReset?.();
}

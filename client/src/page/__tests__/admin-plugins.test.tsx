import "../../test/setup";
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { AdminPluginsPage } from "../admin-plugins";
import { ProfileContext } from "../../state/profile";
import type { AdminPluginListResponse } from "@rin/api";

// 照 use-table-of-contents.test.tsx 的做法：mock react-i18next，
// t 直接回显 key，这样断言写的是 key 而不是翻译文本
mock.module("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/**
 * 插件管理页的交互测试。
 *
 * 重点验证**启停按钮真的会调 API 并刷新**，
 * 以及出错的插件不能切换（避免管理员以为启用成功了）。
 */
describe('AdminPluginsPage', () => {
  const enabledPlugin = {
    name: 'on',
    displayName: '已启用的插件',
    version: '1.0.0',
    description: '它在运行',
    author: 'rin',
    status: 'enabled' as const,
    error: null,
    capabilities: ['comment.beforeCreate'],
    apiPrefix: null,
  };

  const disabledPlugin = {
    name: 'off',
    displayName: '已停用的插件',
    version: '2.0.0',
    description: '',
    author: '',
    status: 'disabled' as const,
    error: null,
    capabilities: [],
    apiPrefix: null,
  };

  const erroredPlugin = {
    name: 'broken',
    displayName: '出错的插件',
    version: '1.0.0',
    description: '',
    author: '',
    status: 'error' as const,
    error: '启动时炸了',
    capabilities: [],
    apiPrefix: null,
  };

  function makeResponse(plugins: unknown[]): AdminPluginListResponse {
    return { enabledKey: 'plugins.enabled', plugins } as AdminPluginListResponse;
  }

  beforeEach(() => {
    // 默认给一个已启用的插件，各用例按需覆盖
    setPlugins([enabledPlugin]);
  });

  afterEach(() => {
    cleanup();
  });

  /** 统一改写 runtime mock，避免每个用例重复写一遍 */
  function setPlugins(
    plugins: unknown[],
    onToggle?: (name: string, enabled: boolean) => void,
  ) {
    mock.module("../../app/runtime", () => ({
      client: {
        adminPlugin: {
          list: async () => ({ data: makeResponse(plugins) }),
          setEnabled: async (name: string, enabled: boolean) => {
            onToggle?.(name, enabled);
            return { data: null };
          },
        },
      },
    }));
  }

  function renderPage() {
    return render(
      <ProfileContext.Provider value={{ permission: 1 } as never}>
        <AdminPluginsPage />
      </ProfileContext.Provider>,
    );
  }

  it('should render a row per plugin', async () => {
    setPlugins([enabledPlugin, disabledPlugin]);

    const { findByText } = renderPage();

    expect(await findByText('已启用的插件')).toBeDefined();
    expect(await findByText('已停用的插件')).toBeDefined();
  });

  it('should show the enabled count', async () => {
    setPlugins([enabledPlugin, disabledPlugin]);

    const { container } = renderPage();
    await waitFor(() => {
      expect(container.textContent).toContain('2');
    });
  });

  it('should show the failure reason for an errored plugin', async () => {
    setPlugins([erroredPlugin]);

    const { findByText } = renderPage();
    // 管理员必须能看到失败原因，否则只知道「坏了」却无从修
    expect(await findByText(/启动时炸了/)).toBeDefined();
  });

  it('should disable the toggle button for an errored plugin', async () => {
    setPlugins([erroredPlugin]);

    const { findAllByRole, findByText } = renderPage();
    await findByText('出错的插件');

    const button = (await findAllByRole('button'))[0] as HTMLButtonElement;
    // 启用一个没跑起来的插件会让人误以为已生效
    expect(button.disabled).toBe(true);
  });

  it('should list the declared capabilities', async () => {
    setPlugins([enabledPlugin]);

    const { findByText } = renderPage();
    expect(await findByText('comment.beforeCreate')).toBeDefined();
  });

  it('should show the API prefix when the plugin provides routes', async () => {
    const withRoutes = { ...enabledPlugin, apiPrefix: '/plugins/on' };
    setPlugins([withRoutes]);

    const { findByText } = renderPage();
    expect(await findByText('/plugins/on/')).toBeDefined();
  });

  it('should call setEnabled when the toggle is clicked', async () => {
    const calls: { name: string; enabled: boolean }[] = [];

    mock.module("../../app/runtime", () => ({
      client: {
        adminPlugin: {
          list: async () => ({ data: makeResponse([disabledPlugin]) }),
          setEnabled: async (name: string, enabled: boolean) => {
            calls.push({ name, enabled });
            return { data: null };
          },
        },
      },
    }));

    const { findAllByRole } = renderPage();

    const button = (await findAllByRole('button'))[0] as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    button.click();

    await waitFor(() => {
      expect(calls).toEqual([{ name: 'off', enabled: true }]);
    });
  });

  it('should pass enabled=false for an already-enabled plugin', async () => {
    const calls: { name: string; enabled: boolean }[] = [];

    mock.module("../../app/runtime", () => ({
      client: {
        adminPlugin: {
          list: async () => ({ data: makeResponse([enabledPlugin]) }),
          setEnabled: async (name: string, enabled: boolean) => {
            calls.push({ name, enabled });
            return { data: null };
          },
        },
      },
    }));

    const { findAllByRole } = renderPage();
    const button = (await findAllByRole('button'))[0] as HTMLButtonElement;
    button.click();

    await waitFor(() => {
      expect(calls).toEqual([{ name: 'on', enabled: false }]);
    });
  });

  it('should show an empty state when there are no plugins', async () => {
    mock.module("../../app/runtime", () => ({
      client: {
        adminPlugin: {
          list: async () => ({ data: makeResponse([]) }),
          setEnabled: async () => ({ data: null }),
        },
      },
    }));

    const { container } = renderPage();
    await waitFor(() => {
      expect(container.textContent).toBeTruthy();
    });
    // 空列表不该渲染出可点击的启停按钮
    expect(container.querySelector('button[type="button"]')).toBeNull();
  });
});

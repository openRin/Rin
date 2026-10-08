import "../../test/setup";
import { describe, it, expect, beforeEach } from "bun:test";
import {
  PLUGIN_PATH_PREFIX,
  findPluginPage,
  findPluginSettings,
  listFrontendPlugins,
  listPluginPages,
  listPluginSlots,
  registerFrontendPlugin,
  resetFrontendPlugins,
} from "../registry";
import type { FrontendPlugin } from "../registry";

function StubPage() {
  return null;
}

function makePlugin(name: string, paths: string[] = ['/plugin/x']): FrontendPlugin {
  return {
    manifest: { name, displayName: name, version: '1.0.0' },
    pages: paths.map((path) => ({ path, title: path, Component: StubPage })),
  };
}

describe('前端插件注册表', () => {
  beforeEach(() => {
    resetFrontendPlugins();
  });

  describe('注册', () => {
    it('should register a plugin with pages', () => {
      registerFrontendPlugin(makePlugin('a', ['/plugin/a']));

      expect(listFrontendPlugins()).toHaveLength(1);
      expect(listPluginPages()).toHaveLength(1);
      expect(listPluginPages()[0].path).toBe('/plugin/a');
    });

    it('should reject a duplicate plugin name', () => {
      registerFrontendPlugin(makePlugin('dup'));
      expect(() => registerFrontendPlugin(makePlugin('dup'))).toThrow(/duplicate/);
    });

    it('should reject a path without the /plugin/ prefix', () => {
      // 插件不能覆盖 /admin/users 这类内置页面
      expect(() => registerFrontendPlugin(makePlugin('bad', ['/admin/users']))).toThrow(
        /must start with/,
      );
    });

    it('should reject a path that is exactly the prefix', () => {
      // 光有前缀没有页面名
      expect(() => registerFrontendPlugin(makePlugin('bad', [PLUGIN_PATH_PREFIX]))).toThrow(
        /must start with/,
      );
    });

    it('should reject a path conflict between plugins', () => {
      registerFrontendPlugin(makePlugin('first', ['/plugin/shared']));

      // 静默覆盖会让先注册的插件页面莫名消失
      expect(() => registerFrontendPlugin(makePlugin('second', ['/plugin/shared']))).toThrow(
        /path conflict/,
      );
    });

    it('should not register anything when one page in the batch is invalid', () => {
      // 原子性：要么全注册成功，要么一个都不注册
      expect(() =>
        registerFrontendPlugin({
          manifest: { name: 'partial', displayName: 'P', version: '1.0.0' },
          pages: [
            { path: '/plugin/ok', title: 'OK', Component: StubPage },
            { path: '/not-plugin', title: 'Bad', Component: StubPage },
          ],
        }),
      ).toThrow();

      expect(listFrontendPlugins()).toHaveLength(0);
    });
  });

  describe('查询', () => {
    it('should find a page by path', () => {
      registerFrontendPlugin(makePlugin('a', ['/plugin/a', '/plugin/b']));

      expect(findPluginPage('/plugin/a')?.path).toBe('/plugin/a');
      expect(findPluginPage('/plugin/b')?.path).toBe('/plugin/b');
      expect(findPluginPage('/plugin/missing')).toBeUndefined();
    });

    it('should not find non-plugin paths', () => {
      registerFrontendPlugin(makePlugin('a', ['/plugin/a']));
      expect(findPluginPage('/feed/1')).toBeUndefined();
    });

    it('should flatten pages from all plugins', () => {
      registerFrontendPlugin(makePlugin('a', ['/plugin/a1', '/plugin/a2']));
      registerFrontendPlugin(makePlugin('b', ['/plugin/b1']));

      expect(listPluginPages().map((p) => p.path)).toEqual([
        '/plugin/a1',
        '/plugin/a2',
        '/plugin/b1',
      ]);
    });
  });

  describe('reset', () => {
    it('should clear the registry', () => {
      registerFrontendPlugin(makePlugin('a', ['/plugin/a']));
      expect(listFrontendPlugins()).toHaveLength(1);

      resetFrontendPlugins();
      expect(listFrontendPlugins()).toHaveLength(0);
      expect(listPluginPages()).toHaveLength(0);
    });

    it('should allow re-registering the same plugin after reset', () => {
      // 测试隔离的关键：不 reset 的话第二个用例会撞 duplicate
      registerFrontendPlugin(makePlugin('same'));
      resetFrontendPlugins();

      expect(() => registerFrontendPlugin(makePlugin('same'))).not.toThrow();
    });
  });
});

describe('插槽与设置项', () => {
  function Stub() {
    return null;
  }

  beforeEach(() => {
    resetFrontendPlugins();
  });

  it('should return only slots matching the requested position', () => {
    registerFrontendPlugin({
      manifest: { name: 'a', displayName: 'A', version: '1.0.0' },
      pages: [],
      slots: [
        { Component: Stub, slot: 'below-header' },
        { Component: Stub, slot: 'above-footer' },
      ],
    });

    expect(listPluginSlots('below-header', '/')).toHaveLength(1);
    expect(listPluginSlots('above-footer', '/')).toHaveLength(1);
    expect(listPluginSlots('sidebar', '/')).toHaveLength(0);
  });

  it('should filter slots by onlyPaths', () => {
    registerFrontendPlugin({
      manifest: { name: 'album', displayName: 'Album', version: '1.0.0' },
      pages: [],
      slots: [{ Component: Stub, slot: 'below-header', onlyPaths: ['/'] }],
    });

    expect(listPluginSlots('below-header', '/')).toHaveLength(1);
    // 非首页不显示 —— 这正是相册「只在首页」的声明
    expect(listPluginSlots('below-header', '/about')).toHaveLength(0);
  });

  it('should show a slot on all paths when onlyPaths is omitted', () => {
    registerFrontendPlugin({
      manifest: { name: 'banner', displayName: 'B', version: '1.0.0' },
      pages: [],
      slots: [{ Component: Stub, slot: 'below-header' }],
    });

    expect(listPluginSlots('below-header', '/')).toHaveLength(1);
    expect(listPluginSlots('below-header', '/about')).toHaveLength(1);
  });

  it('should return empty when no plugin declares the slot', () => {
    expect(listPluginSlots('below-header', '/')).toHaveLength(0);
  });

  it('should expose declared settings for a plugin', () => {
    registerFrontendPlugin({
      manifest: { name: 'album', displayName: 'Album', version: '1.0.0' },
      pages: [],
      settings: [
        { key: 'images', label: '图片', field: { type: 'imageList' } },
        { key: 'interval', label: '间隔', field: { type: 'number' } },
      ],
    });

    const settings = findPluginSettings('album');
    expect(settings).toHaveLength(2);
    expect(settings[0].key).toBe('images');
  });

  it('should return an empty list for plugins without settings', () => {
    registerFrontendPlugin({
      manifest: { name: 'bare', displayName: 'B', version: '1.0.0' },
      pages: [],
    });

    expect(findPluginSettings('bare')).toEqual([]);
    expect(findPluginSettings('nonexistent')).toEqual([]);
  });
});

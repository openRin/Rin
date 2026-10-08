/** 插件配置读取。复用 serverConfig 体系，键名规则 `{插件名}.{配置项}`，后台可直接编辑 */

import type { CacheImpl } from '../core/hono-types';
import type { PluginConfigReader } from './types';

/** 创建配置读取器。`pluginName` 作为配置键前缀，`config` 为 serverConfig 实例 */
export function createPluginConfigReader(
  pluginName: string,
  config: CacheImpl,
): PluginConfigReader {
  /** 拼出完整键名。空 key 直接返回前缀，允许读插件级总开关 */
  const fullKey = (key: string): string =>
    key ? `${pluginName}.${key}` : pluginName;

  return {
    async string(key: string, defaultValue: string): Promise<string> {
      const value = await config.get(fullKey(key));
      // 空字符串视为「未设置」（后台清空输入框存的就是空串），用默认值
      if (value === null || value === undefined || value === '') {
        return defaultValue;
      }
      return String(value);
    },

    async number(key: string, defaultValue: number): Promise<number> {
      const raw = await config.get(fullKey(key));
      if (raw === null || raw === undefined || raw === '') {
        return defaultValue;
      }
      const parsed = Number(raw);
      // 存了非数字就用默认值，不要返回 NaN 让下游算崩
      return Number.isFinite(parsed) ? parsed : defaultValue;
    },

    async boolean(key: string, defaultValue: boolean): Promise<boolean> {
      const raw = await config.get(fullKey(key));
      if (raw === null || raw === undefined || raw === '') {
        return defaultValue;
      }
      if (typeof raw === 'boolean') return raw;
      // 配置值可能是字符串 'true' / '1'（管理后台存的都是字符串）
      const normalized = String(raw).trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
      // 无法识别的值回落到默认值
      return defaultValue;
    },

    async stringList(key: string, defaultValue: string[]): Promise<string[]> {
      const raw = await config.get(fullKey(key));
      if (raw === null || raw === undefined || raw === '') {
        return defaultValue;
      }
      // 数组直接返回（配置里存的可能是 JSON），字符串按逗号或换行切分
      if (Array.isArray(raw)) {
        return raw.map((item) => String(item).trim()).filter(Boolean);
      }
      return String(raw)
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    },
  };
}

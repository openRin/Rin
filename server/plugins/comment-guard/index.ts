/**
 * 评论敏感词过滤（示例插件）。
 *
 * 演示：读自身配置、在 beforeCreate 拦截（返回字符串即拒绝）、
 * 提供后台查询端点。配置见 comment-guard.blockedWords / enabled。
 */

import type { PluginContext, RinPlugin } from '../../src/plugins/types';
import { PluginRejectionError } from '../../src/plugins/registry';

const plugin: RinPlugin = {
  manifest: {
    name: 'comment-guard',
    displayName: '评论敏感词过滤',
    version: '1.0.0',
    description: '拦截包含敏感词的评论。配置项：comment-guard.blockedWords',
    author: 'Rin',
  },

  async setup(ctx: PluginContext) {
    // setup 适合做一次性初始化，比如校验配置是否合理
    const words = await ctx.config.stringList('blockedWords', []);
    ctx.log.info(`已加载，敏感词 ${words.length} 个`);
  },

  comment: {
    async beforeCreate(input, ctx) {
      const enabled = await ctx.config.boolean('enabled', true);
      if (!enabled) return;

      const words = await ctx.config.stringList('blockedWords', []);
      if (words.length === 0) return;

      // 转小写比较，避免「违禁词」与「违禁词」大小写不同绕过
      const haystack = input.content.toLowerCase();
      const hit = words.find((word) => {
        const needle = word.trim().toLowerCase();
        return needle.length > 0 && haystack.includes(needle);
      });

      if (hit) {
        ctx.log.warn('拦截到敏感词', {
          feedId: input.feedId,
          word: hit,
        });
        // 返回非空字符串 = 拒绝本次提交，用户会看到这段文案
        return `评论包含不允许的内容（${hit}），请修改后重试`;
      }

      return undefined;
    },
  },

  routes(app) {
    // 挂载到 /plugins/comment-guard/ 下
    // 插件自行决定鉴权 —— 这里是公开信息，不需要登录
    app.get('/status', async (c) => {
      // 从 Hono context 拿不到插件的 config（它在闭包里），
      // 所以这里用环境变量做示例；真实插件可以在 setup 时把词表存进 cache
      return c.json({
        ok: true,
        plugin: 'comment-guard',
        version: plugin.manifest.version,
      });
    });
  },
};

export default plugin;

// 保留 PluginRejectionError 的导入，供其他插件参考「如何主动拒绝」
void PluginRejectionError;

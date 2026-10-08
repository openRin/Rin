/**
 * 首页顶部相册轮播（服务端部分）。
 *
 * 纯前端展示，服务端只声明哪些配置键可公开给浏览器 ——
 * serverConfig 混有 SMTP 密码等敏感值，不能整体下发。
 */

import type { RinPlugin } from '../../src/plugins/types';

const plugin: RinPlugin = {
  manifest: {
    name: 'photo-album',
    displayName: '相册轮播',
    version: '1.0.0',
    description: '在页头导航下方展示图片轮播。图片可上传或填网址',
    author: 'Rin',
  },

  // 只有这三个键会被 /api/plugins/photo-album/config 返回。
  // 加新键时记得同步更新 client/plugins/photo-album/index.tsx 的 settings 声明。
  publicSettings: ['images', 'interval', 'height'],

  // 全部设置键（含非公开的 captions）。管理员设置页靠它逐键读回当前值。
  settingKeys: ['images', 'captions', 'interval', 'height'],
};

export default plugin;

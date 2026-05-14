import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  title: 'Rin',
  description: '️Rin 是一个基于 Cloudflare Pages + Workers + D1 + R2 全家桶的博客，无需服务器无需备案，只需要一个解析到 Cloudflare 的域名即可部署。 ',
  icon: '/rin-icon.png',
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Rin',
      description: 'Dynamic blog based on Cloudflare',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Rin',
      description: '基于 Cloudflare 的动态博客系统',
    },
  ],
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/openRin/Rin' },
    ],
  },
  i18nSource: {
    outlineTitle: {
      zh: '大纲',
      en: 'ON THIS Page',
    },
  },
});

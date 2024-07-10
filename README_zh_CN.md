# Rin

[English](./README.md) | 简体中文


![封面](https://repository-images.githubusercontent.com/803866357/958bc2c1-1703-4127-920c-853291495bdc)

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/openRin/Rin?style=for-the-badge)
![GitHub branch check runs](https://img.shields.io/github/check-runs/openRin/Rin/main?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/openRin/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/openRin/Rin?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/openRin/Rin/deploy.yaml?style=for-the-badge)

# 介绍

Rin 是一个基于 Cloudflare Pages + Workers + D1 + R2 全家桶的博客，无需服务器无需备案，只需要一个解析到 Cloudflare 的域名即可部署。

## 演示地址

[xeu.life](https://xeu.life)


## 特性
1. 支持 Github OAuth 登录，默认第一个登录的用户拥有管理权限，其他用户均为普通用户
2. 支持文章的写作与编辑
3. 支持本地实时保存对任意文章的修改/编辑且多篇文章互不干扰
4. 支持设置为仅自己可见，可以充当云端同步的草稿箱或者记录隐私性较强的内容
5. 支持拖拽/粘贴上传图片到支持 S3 协议的存储桶并生成链接
6. 支持设置文章别名，可通过形如 https://xeu.life/about 链接访问文章
7. 支持文章不列出在首页列表中
8. 支持添加友链，同时后端每间隔 20 分钟定期检查更新友链可访问状态
9. 支持回复评论文章/删除评论
10. 支持通过 Webhook 发送评论通知
11. 支持自动识别文章中的第一张图片并作为头图展示在文章列表中
12. 支持输入形如"#博客 #部署 #Cloudflare"之类的标签文本并自动解析为标签
13. 更多特性请参考 https://xeu.life

# 文档

[rin-docs.xeu.life](https://rin-docs.xeu.life)

## Star History

<a href="https://star-history.com/#openRin/Rin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
 </picture>
</a>

# License
```
MIT License

Copyright (c) 2024 Xeu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

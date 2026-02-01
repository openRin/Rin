# English Version

# Rin

English | [简体中文](./README_zh_CN.md)

![Cover](./docs/docs/public/rin-logo.png)

!https://img.shields.io/github/commit-activity/w/openRin/Rin?style=for-the-badge
!https://img.shields.io/github/check-runs/openRin/Rin/main?style=for-the-badge
!https://img.shields.io/github/languages/top/openRin/Rin?style=for-the-badge
!https://img.shields.io/github/license/openRin/Rin?style=for-the-badge
!https://img.shields.io/github/actions/workflow/status/openRin/Rin/deploy.yaml?style=for-the-badge

https://img.shields.io/badge/Discord-openRin-red?style=for-the-badge&color=%236e7acc](https://discord.gg/JWbSTHvAPN)
https://img.shields.io/badge/Telegram-openRin-red?style=for-the-badge&color=%233390EC](https://t.me/openRin)

## Introduction

Rin is a modern, serverless blog platform built entirely on Cloudflare's developer platform: Pages for hosting, Workers for serverless functions, D1 for SQLite database, and R2 for object storage. Deploy your personal blog with just a domain name pointed to Cloudflare—no server management required.

## Live Demo

https://xeu.life

## Features
- **Authentication & Management**: GitHub OAuth login. The first registered user becomes an administrator, while subsequent users join as regular members.
- **Content Creation**: Write and edit articles with a rich, intuitive editor.
- **Real-time Autosave**: Local drafts are saved automatically in real-time, with isolation between different articles.
- **Privacy Control**: Mark articles as "Visible only to me" for private drafts or personal notes, synchronized across devices.
- **Image Management**: Drag-and-drop or paste images to upload directly to S3-compatible storage (e.g., Cloudflare R2), with automatic link generation.
- **Custom Slugs**: Assign friendly URLs like `https://yourblog.com/about` using custom article aliases.
- **Unlisted Posts**: Option to keep articles out of the public homepage listing.
- **Blogroll**: Add links to friends' blogs. The backend automatically checks link availability every 20 minutes.
- **Comment System**: Reply to comments or moderate them with delete functionality.
- **Webhook Notifications**: Receive real-time alerts for new comments via configurable webhooks.
- **Featured Images**: Automatically detect the first image in an article and use it as the cover image in listings.
- **Tag Parsing**: Input tags like `#Blog #Cloudflare` and have them automatically parsed and displayed.
- ...and more! Explore all features at https://xeu.life.

## Documentation

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/openRin/Rin.git && cd Rin

# 2. Install dependencies
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your own configuration

# 4. Start the development server
bun run dev
```

Visit http://localhost:5173 to start hacking!

Full documentation is available at https://docs.openrin.org.

## Community & Support

- Join our https://discord.gg/JWbSTHvAPN for discussions and help.
- Follow updates on https://t.me/openRin.
- Found a bug or have a feature request? Please open an issue on GitHub.

## Star History

<a href="https://star-history.com/#openRin/Rin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=openRin/Rin&type=Date" />
 </picture>
</a>

## Contributing

We welcome contributions of all kinds—code, documentation, design, and ideas. Please check out our [contributing guidelines](https://docs.openrin.org/en/guide/contribution.html) and join us in building Rin together!

## License

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

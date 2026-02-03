import { PutObjectCommand } from "@aws-sdk/client-s3";
import { and, desc, eq } from "drizzle-orm";
import { Feed } from "feed";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { DB } from "../context";
import { feeds, users } from "../db/schema";
import base from "../base";
import { extractImage } from "../utils/image";
import { path_join } from "../utils/path";
import { createS3Client } from "../utils/s3";
import { FAVICON_ALLOWED_TYPES, getFaviconKey } from "./favicon";


export const RSSService = () => base()
    .get('/sub/:name', async ({ set, params: { name }, store: { env } }) => {
        const endpoint = env.S3_ENDPOINT;
        const accessHost = env.S3_ACCESS_HOST || endpoint;
        const folder = env.S3_CACHE_FOLDER || 'cache/';
        const host = `${(accessHost.startsWith("http://") || accessHost.startsWith("https://") ? '' :'https://')}${accessHost}`;
        if (!host) {
            set.status = 500;
            return 'S3_ACCESS_HOST is not defined'
        }
        if (name === 'feed.xml') {
            name = 'rss.xml';
        }
        if (['rss.xml', 'atom.xml', 'rss.json'].includes(name)) {
            const key = path_join(folder, name);
            try {
                const url = `${host}/${key}`;
                console.log(`Fetching ${url}`);
                const response = await fetch(new Request(url))
                const contentType = name === 'rss.xml' ? 'application/rss+xml; charset=UTF-8' : name === 'atom.xml' ? 'application/atom+xml; charset=UTF-8' : 'application/feed+json; charset=UTF-8';
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=3600',
                    }
                });
            } catch (e: any) {
                console.error(e);
                set.status = 500;
                return e.message;
            }
        }
        set.status = 404;
        return 'Not Found';
    })

export async function rssCrontab(env: Env, db: DB) {
    const frontendUrl = `${env.FRONTEND_URL.startsWith("http://") || env.FRONTEND_URL.startsWith("https://") ? "" : "https://"}${env.FRONTEND_URL}`;
    const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
    const faviconKey = getFaviconKey(env);

    let feedConfig: any = {
        title: env.RSS_TITLE,
        description: env.RSS_DESCRIPTION || "Feed from Rin",
        id: frontendUrl,
        link: frontendUrl,
        copyright: "All rights reserved 2024",
        updated: new Date(), // optional, default = today
        generator: "Feed from Rin", // optional, default = 'Feed for Node.js'
        feedLinks: {
            rss: `${frontendUrl}/sub/rss.xml`,
            json: `${frontendUrl}/sub/rss.json`,
            atom: `${frontendUrl}/sub/atom.xml`,
        },
    };

    if (!feedConfig.title) {
        const user = await db.query.users.findFirst({ where: eq(users.id, 1) });
        if (user) {
            feedConfig.title = user.username;
        }
    }

    for (const [_mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
        const originFaviconKey = path_join(
            env.S3_FOLDER || "",
            `originFavicon${ext}`,
        );
        try {
            const response = await fetch(
                new Request(`${accessHost}/${originFaviconKey}`),
            );
            if (response.ok) {
                feedConfig.image = `${accessHost}/${originFaviconKey}`;
                break;
            }
        } catch (error) {
            continue;
        }
    }

    try {
        const response = await fetch(
            new Request(`${accessHost}/${faviconKey}`),
        );
        if (response.ok) {
            feedConfig.favicon = `${accessHost}/${faviconKey}`;
        }
    } catch (error) {}

    const feed = new Feed(feedConfig);

    const feed_list = await db.query.feeds.findMany({
        where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: 20,
        with: {
            user: {
                columns: { id: true, username: true, avatar: true },
            },
        },
    });
    for (const f of feed_list) {
        const { summary, content, user, ...other } = f;
        const file = await unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkRehype)
            .use(rehypeStringify)
            .process(content);
        let contentHtml = file.toString();
        feed.addItem({
            title: other.title || "No title",
            id: other.id?.toString() || "0",
            link: `${frontendUrl}/feed/${other.id}`,
            date: other.createdAt,
            description:
                summary.length > 0
                    ? summary
                    : content.length > 100
                      ? content.slice(0, 100)
                      : content,
            content: contentHtml,
            author: [{ name: user.username }],
            image: extractImage(content),
        });
    }
    // save rss.xml to s3
    console.log("save rss.xml to s3");
    const bucket = env.S3_BUCKET;
    const folder = env.S3_CACHE_FOLDER || "cache/";
    const s3 = createS3Client(env);
    async function save(name: string, data: string) {
        const hashkey = path_join(folder, name);
        try {
            await s3.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: hashkey,
                    Body: data,
                }),
            );
        } catch (e: any) {
            console.error(e.message);
        }
    }
    await save("rss.xml", feed.rss2());
    console.log("Saved atom.xml to s3");
    await save("atom.xml", feed.atom1());
    console.log("Saved rss.json to s3");
    await save("rss.json", feed.json1());
    console.log("Saved rss.xml to s3");
}

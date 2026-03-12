import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feeds, users } from "../db/schema";
import { extractImage } from "../utils/image";
import { path_join } from "../utils/path";
import { getStorageObject, getStoragePublicUrl, headStorageObject, putStorageObjectAtKey } from "../utils/storage";
import { FAVICON_ALLOWED_TYPES, getFaviconKey } from "./favicon";
import type { DB } from "../core/hono-types";

// Lazy-loaded modules for RSS generation
let Feed: any;
let unified: any;
let remarkParse: any;
let remarkGfm: any;
let remarkRehype: any;
let rehypeStringify: any;

async function initRSSModules() {
    if (!Feed) {
        const feed = await import("feed");
        Feed = feed.Feed;
    }
    if (!unified) {
        const unifiedMod = await import("unified");
        const remarkParseMod = await import("remark-parse");
        const remarkGfmMod = await import("remark-gfm");
        const remarkRehypeMod = await import("remark-rehype");
        const rehypeStringifyMod = await import("rehype-stringify");
        
        unified = unifiedMod.unified;
        remarkParse = remarkParseMod.default;
        remarkGfm = remarkGfmMod.default;
        remarkRehype = remarkRehypeMod.default;
        rehypeStringify = rehypeStringifyMod.default;
    }
}

export function RSSService(): Hono {
    const app = new Hono();

    // GET /rss.xml
    app.get('/rss.xml', async (c: AppContext) => {
        return handleFeed(c, 'rss.xml');
    });

    // GET /atom.xml
    app.get('/atom.xml', async (c: AppContext) => {
        return handleFeed(c, 'atom.xml');
    });

    // GET /rss.json
    app.get('/rss.json', async (c: AppContext) => {
        return handleFeed(c, 'rss.json');
    });

    // GET /feed.json
    app.get('/feed.json', async (c: AppContext) => {
        return handleFeed(c, 'feed.json');
    });

    // Support legacy feed.xml - redirect to rss.xml
    app.get('/feed.xml', async (c: AppContext) => {
        return c.redirect('/rss.xml', 301);
    });

    return app;
}

async function handleFeed(c: AppContext, fileName: string) {
    const env = c.get('env');
    const db = c.get('db');

    const folder = env.S3_CACHE_FOLDER || 'cache/';

    // Map file extensions to proper MIME types
    const contentTypeMap: Record<string, string> = {
        'rss.xml': 'application/rss+xml; charset=UTF-8',
        'atom.xml': 'application/atom+xml; charset=UTF-8',
        'rss.json': 'application/feed+json; charset=UTF-8',
        'feed.json': 'application/feed+json; charset=UTF-8',
    };
    const contentType = contentTypeMap[fileName] || 'application/xml';

    // Try to fetch from S3 first (if configured)
    const key = path_join(folder, fileName);
    
    try {
        const response = await profileAsync(c, 'rss_s3_fetch', () => getStorageObject(env, key));

        if (response) {
            console.log(`[RSS] Storage hit for ${key}`);
            const text = await profileAsync(c, 'rss_s3_body', () => response.text());
            return c.text(text, 200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            });
        }
    } catch (e: any) {
        console.log(`[RSS] Storage fetch failed: ${e.message}, falling back to generation`);
    }
    
    // Generate feed in real-time (fallback or primary mode)
    try {
        console.log(`[RSS] Generating ${fileName} in real-time...`);
        const frontendUrl = new URL(c.req.url).origin;
        const feed = await profileAsync(c, 'rss_generate_feed', () => generateFeed(env, db, frontendUrl, c));
        
        let content: string;
        switch (fileName) {
            case 'rss.xml':
                content = await profileAsync(c, 'rss_render_rss2', () => Promise.resolve(feed.rss2()));
                break;
            case 'atom.xml':
                content = await profileAsync(c, 'rss_render_atom', () => Promise.resolve(feed.atom1()));
                break;
            case 'rss.json':
            case 'feed.json':
                content = await profileAsync(c, 'rss_render_json', () => Promise.resolve(feed.json1()));
                break;
            default:
                content = await profileAsync(c, 'rss_render_default', () => Promise.resolve(feed.rss2()));
        }
        
        return c.text(content, 200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=300', // Shorter cache for real-time
        });
    } catch (genError: any) {
        console.error('[RSS] Generation failed:', genError);
        return c.text(`RSS generation failed: ${genError.message}`, 500);
    }
}

// Extract feed generation logic for reuse
async function generateFeed(env: Env, db: DB, frontendUrl: string, c?: AppContext) {
    if (c) {
        await profileAsync(c, 'rss_init_modules', () => initRSSModules());
    } else {
        await initRSSModules();
    }
    const faviconKey = getFaviconKey(env);
    const publicBaseUrl = frontendUrl || undefined;

    let feedConfig: any = {
        title: env.RSS_TITLE,
        description: env.RSS_DESCRIPTION || "Feed from Rin",
        id: frontendUrl,
        link: frontendUrl,
        copyright: "All rights reserved 2024",
        updated: new Date(),
        generator: "Feed from Rin",
        feedLinks: {
            // Native RSS support - feeds are now served from root path
            rss: `${frontendUrl}/rss.xml`,
            json: `${frontendUrl}/rss.json`,
            atom: `${frontendUrl}/atom.xml`,
        },
    };

    if (!feedConfig.title) {
        const user = c
            ? await profileAsync(c, 'rss_user_lookup', () => db.query.users.findFirst({ where: eq(users.id, 1) }))
            : await db.query.users.findFirst({ where: eq(users.id, 1) });
        if (user) {
            feedConfig.title = user.username;
        }
    }

    // Try to discover stored favicon assets.
    for (const [_mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
        const originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
        try {
            const response = c
                ? await profileAsync(c, 'rss_origin_favicon_fetch', () => headStorageObject(env, originFaviconKey))
                : await headStorageObject(env, originFaviconKey);
            if (response) {
                feedConfig.image = getStoragePublicUrl(env, originFaviconKey, publicBaseUrl);
                break;
            }
        } catch (error) {
            continue;
        }
    }

    try {
        const response = c
            ? await profileAsync(c, 'rss_favicon_fetch', () => headStorageObject(env, faviconKey))
            : await headStorageObject(env, faviconKey);
        if (response) {
            feedConfig.favicon = getStoragePublicUrl(env, faviconKey, publicBaseUrl);
        }
    } catch (error) { }

    const feed = new Feed(feedConfig);

    // Get published feeds
    const feed_list = c
        ? await profileAsync(c, 'rss_feed_list', () => db.query.feeds.findMany({
            where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
            orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
            limit: 20,
            with: {
                user: { columns: { id: true, username: true, avatar: true } },
            },
        }))
        : await db.query.feeds.findMany({
        where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: 20,
        with: {
            user: { columns: { id: true, username: true, avatar: true } },
        },
    });

    for (const f of feed_list) {
        const { summary, content, user, ...other } = f;
        
        // Convert markdown to HTML
        let contentHtml = '';
        if (content) {
            try {
                const file = await unified()
                    .use(remarkParse)
                    .use(remarkGfm)
                    .use(remarkRehype)
                    .use(rehypeStringify)
                    .process(content);
                contentHtml = file.toString();
            } catch (e) {
                console.error('[RSS] Markdown conversion error:', e);
                contentHtml = content;
            }
        }

        feed.addItem({
            title: other.title || "No title",
            id: other.id?.toString() || "0",
            link: `${frontendUrl}/feed/${other.id}`,
            date: other.createdAt,
            description: summary.length > 0
                ? summary
                : content.length > 100
                    ? content.slice(0, 100)
                    : content,
            content: contentHtml,
            author: user ? [{ name: user.username }] : undefined,
            image: extractImage(content),
        });
    }
    
    return feed;
}

export async function rssCrontab(env: Env, db: DB) {
    // Generate feed
    // For cron jobs, we don't have a request context, so we use a placeholder
    // The RSS feeds generated by cron jobs will be stored in S3 and served from there
    const frontendUrl = '';
    const feed = await generateFeed(env, db, frontendUrl);
    
    // Save to S3 (if configured)
    const folder = env.S3_CACHE_FOLDER || "cache/";

    async function save(name: string, data: string) {
        const hashkey = path_join(folder, name);
        try {
            await putStorageObjectAtKey(
                env,
                hashkey,
                data,
                name.endsWith('.json') ? 'application/json' : 'application/xml'
            );
            console.log(`[RSS] Saved ${name} to S3`);
        } catch (e: any) {
            console.error(`[RSS] Failed to save ${name}:`, e.message);
        }
    }

    await save("rss.xml", feed.rss2());
    await save("atom.xml", feed.atom1());
    await save("rss.json", feed.json1());
}

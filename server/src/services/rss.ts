import { and, desc, eq } from "drizzle-orm";
import { Router } from "../core/router";
import type { Context } from "../core/types";
import { feeds, users } from "../db/schema";
import { extractImage } from "../utils/image";
import { path_join } from "../utils/path";
import { createS3Client, putObject } from "../utils/s3";
import { FAVICON_ALLOWED_TYPES, getFaviconKey } from "./favicon";
import type { DB } from "../server";

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

export function RSSService(router: Router): void {
    // Serve RSS feeds directly from root path (native RSS support)
    // Routes: /rss.xml, /atom.xml, /feed.json
    router.get('/:name', async (ctx: Context) => {
        const { set, params, store: { env, db } } = ctx;
        const { name } = params;

        const endpoint = env.S3_ENDPOINT;
        const accessHost = env.S3_ACCESS_HOST || endpoint;
        const folder = env.S3_CACHE_FOLDER || 'cache/';
        const host = `${(accessHost.startsWith("http://") || accessHost.startsWith("https://") ? '' : 'https://')}${accessHost}`;

        let fileName = name;
        // Support legacy feed.xml redirect to rss.xml
        if (fileName === 'feed.xml') {
            fileName = 'rss.xml';
        }

        if (!['rss.xml', 'atom.xml', 'rss.json', 'feed.json'].includes(fileName)) {
            set.status = 404;
            return 'Not Found';
        }

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
        const cleanHost = host.endsWith('/') ? host.slice(0, -1) : host;
        const url = `${cleanHost}/${key}`;
        
        // Check if S3 is properly configured (not default/placeholder values)
        const s3Configured = host && 
                           !host.includes('your-') && 
                           !host.includes('undefined') &&
                           env.S3_BUCKET && 
                           !env.S3_BUCKET.includes('your-bucket');
        
        if (s3Configured) {
            try {
                console.log(`[RSS] Fetching from S3: ${url}`);
                const response = await fetch(url, { 
                    cf: { cacheTtl: 60 } 
                });
                
                if (response.ok) {
                    console.log(`[RSS] S3 hit!`);
                    const text = await response.text();
                    return new Response(text, {
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=3600',
                        }
                    });
                }
                
                if (response.status !== 404) {
                    console.log(`[RSS] S3 error: ${response.status}, falling back to generation`);
                }
            } catch (e: any) {
                console.log(`[RSS] S3 fetch failed: ${e.message}, falling back to generation`);
            }
        } else {
            console.log(`[RSS] S3 not configured, generating feed in real-time`);
        }
        
        // Generate feed in real-time (fallback or primary mode)
        try {
            console.log(`[RSS] Generating ${fileName} in real-time...`);
            const feed = await generateFeed(env, db);
            
            let content: string;
            switch (fileName) {
                case 'rss.xml':
                    content = feed.rss2();
                    break;
                case 'atom.xml':
                    content = feed.atom1();
                    break;
                case 'rss.json':
                case 'feed.json':
                    content = feed.json1();
                    break;
                default:
                    content = feed.rss2();
            }
            
            return new Response(content, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=300', // Shorter cache for real-time
                }
            });
        } catch (genError: any) {
            console.error('[RSS] Generation failed:', genError);
            set.status = 500;
            return `RSS generation failed: ${genError.message}`;
        }
    });
}

// Extract feed generation logic for reuse
async function generateFeed(env: Env, db: DB) {
    await initRSSModules();
    
    const frontendUrl = `${env.FRONTEND_URL.startsWith("http://") || env.FRONTEND_URL.startsWith("https://") ? "" : "https://"}${env.FRONTEND_URL}`;
    const accessHost = env.S3_ACCESS_HOST || env.S3_ENDPOINT;
    const faviconKey = getFaviconKey(env);

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
        const user = await db.query.users.findFirst({ where: eq(users.id, 1) });
        if (user) {
            feedConfig.title = user.username;
        }
    }

    // Try to get favicon from S3
    if (accessHost && !accessHost.includes('your-') && !accessHost.includes('undefined')) {
        for (const [_mimeType, ext] of Object.entries(FAVICON_ALLOWED_TYPES)) {
            const originFaviconKey = path_join(env.S3_FOLDER || "", `originFavicon${ext}`);
            try {
                const response = await fetch(new Request(`${accessHost}/${originFaviconKey}`));
                if (response.ok) {
                    feedConfig.image = `${accessHost}/${originFaviconKey}`;
                    break;
                }
            } catch (error) {
                continue;
            }
        }

        try {
            const response = await fetch(new Request(`${accessHost}/${faviconKey}`));
            if (response.ok) {
                feedConfig.favicon = `${accessHost}/${faviconKey}`;
            }
        } catch (error) { }
    }

    const feed = new Feed(feedConfig);

    // Get published feeds
    const feed_list = await db.query.feeds.findMany({
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
    const feed = await generateFeed(env, db);
    
    // Save to S3 (if configured)
    const folder = env.S3_CACHE_FOLDER || "cache/";
    const s3 = createS3Client(env);

    async function save(name: string, data: string) {
        const hashkey = path_join(folder, name);
        try {
            await putObject(
                s3,
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

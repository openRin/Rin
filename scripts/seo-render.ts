import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import puppeteer from 'puppeteer';
import path from "node:path"

const env = process.env;
const baseUrl = env.SEO_BASE_URL || env.FRONTEND_URL || '';
const containsKey = env.SEO_CONTAINS_KEY || '';
const region = env.S3_REGION;
const endpoint = env.S3_ENDPOINT;
const accessKeyId = env.S3_ACCESS_KEY_ID;
const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
const accessHost = env.S3_ACCESS_HOST || endpoint;
const bucket = env.S3_BUCKET;
const folder = env.S3_CACHE_FOLDER || 'cache/';
const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";
if (!baseUrl) {
    throw new Error('SEO_BASE_URL is not defined');
}
if (!region) {
    throw new Error('S3_REGION is not defined');
}
if (!endpoint) {
    throw new Error('S3_ENDPOINT is not defined');
}
if (!accessKeyId) {
    throw new Error('S3_ACCESS_KEY_ID is not defined');
}
if (!secretAccessKey) {
    throw new Error('S3_SECRET_ACCESS_KEY is not defined');
}
if (!bucket) {
    throw new Error('S3_BUCKET is not defined');
}
const s3 = new S3Client({
    region: region,
    endpoint: endpoint,
    forcePathStyle: forcePathStyle,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    }
});

async function saveFile(filename: string, data: string) {
    // Save data to file
    console.log(`Saving ${filename}`);
    const url = new URL(filename)
    let fileName = path.join(folder, url.pathname + url.search.replace('?', '&'))
    if (fileName.endsWith('/')) {
        fileName += 'index.html';
    }
    try {
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileName, Body: data, ContentType: 'text/html' }))
        console.info(`Saved ${accessHost}/${fileName}.`)
    } catch (e: any) {
        console.error(e.message)
    }
}

// Fetch All Links
const fetchedLinks = new Set<string>();
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

async function fetchPage(url: string) {
    // Fetch page content
    console.log(`Fetching ${url}`);
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    if (!response) {
        console.error(`Failed to fetch ${url}`);
        return;
    }
    if (response.ok() && response.headers()['content-type']?.includes('text/html')) {
        const html = await page.content();
        await saveFile(url, html);
        fetchedLinks.add(url);
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(anchor => anchor.href);
        });
        for (const link of links.filter(link => (link.startsWith(baseUrl) || (containsKey != '' && link.includes(containsKey))))) {
            const linkWithoutHash = link.split('#')[0];
            if (fetchedLinks.has(linkWithoutHash)) {
                continue;
            }
            await fetchPage(linkWithoutHash);
        }
    }
}

await fetchPage(baseUrl);
await browser.close();
console.log('🎉All Done.');
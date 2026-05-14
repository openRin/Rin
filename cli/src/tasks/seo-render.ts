import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "node:path";
import puppeteer from "puppeteer";

export async function runSeoRender() {
  const env = process.env;
  const baseUrl = env.SEO_BASE_URL || "";
  const containsKey = env.SEO_CONTAINS_KEY || "";
  const region = env.S3_REGION;
  const endpoint = env.S3_ENDPOINT;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  const accessHost = env.S3_ACCESS_HOST || endpoint;
  const bucket = env.S3_BUCKET;
  const folder = env.S3_CACHE_FOLDER || "cache/";
  const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";

  if (!baseUrl || !region || !endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("SEO render env is incomplete");
  }

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  async function saveFile(filename: string, data: string) {
    const url = new URL(filename);
    let fileName = path.join(folder, url.pathname + url.search.replace("?", "&"));
    if (fileName.endsWith("/")) fileName += "index.html";
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fileName, Body: data, ContentType: "text/html" }));
    console.info(`Saved ${accessHost}/${fileName}.`);
  }

  const fetchedLinks = new Set<string>();
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36";

  async function fetchPage(url: string): Promise<void> {
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    if (!response) return;
    if (response.ok() && response.headers()["content-type"]?.includes("text/html")) {
      await saveFile(url, await page.content());
      fetchedLinks.add(url);
      const links = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map((anchor) => anchor.href));
      for (const link of links.filter((candidate) => candidate.startsWith(baseUrl) || (containsKey && candidate.includes(containsKey)))) {
        const next = link.split("#")[0];
        if (!fetchedLinks.has(next)) {
          await fetchPage(next);
        }
      }
    }
    await page.close();
  }

  await fetchPage(baseUrl);
  await browser.close();
}

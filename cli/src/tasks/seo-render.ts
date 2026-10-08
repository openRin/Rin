import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import puppeteer from "puppeteer";
import { resolveStorageConfig } from "../lib/storage-config";

export async function runSeoRender() {
  const env = process.env;
  const baseUrl = env.SEO_BASE_URL || "";
  const containsKey = env.SEO_CONTAINS_KEY || "";
  const storage = resolveStorageConfig(env);
  const folder = env.S3_CACHE_FOLDER || "cache/";

  if (!baseUrl) {
    throw new Error("SEO render env is incomplete");
  }

  if (storage.missing.length > 0) {
    throw new Error(`SEO render storage config incomplete: ${storage.missing.join(", ")}`);
  }

  const saveFile = storage.provider === "supabase"
    ? createSupabaseWriter(env, folder)
    : createS3Writer(storage.vars, folder);

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

/** 把 URL 映射为缓存对象键，与服务端保持一致 */
function buildCacheKey(folder: string, filename: string) {
  const url = new URL(filename);
  const base = folder.endsWith("/") ? folder : `${folder}/`;
  // query 里可能携带 "/.." 片段，剔除后保证键不越出缓存目录；存储键统一用 posix 分隔符
  const raw = url.pathname.replace(/^\//, "") + url.search.replace("?", "&");
  const rest = raw.split("/").filter((segment) => segment !== "" && segment !== "." && segment !== "..");
  const folderPrefix = base.split("/").filter(Boolean);
  const key = [...folderPrefix, ...rest].join("/");
  return key === folderPrefix.join("/") ? `${key}/index.html` : key;
}

function createS3Writer(vars: Record<string, string>, folder: string) {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";

  // R2 provider 不要求 S3 凭证，但 SEO 预渲染始终经S3 API 写入，需显式校验
  if (!vars.S3_ENDPOINT || !vars.S3_BUCKET || !accessKeyId || !secretAccessKey) {
    throw new Error("SEO render S3 config incomplete");
  }

  const accessHost = vars.S3_ACCESS_HOST || vars.S3_ENDPOINT;
  const s3 = new S3Client({
    region: vars.S3_REGION || "auto",
    endpoint: vars.S3_ENDPOINT,
    forcePathStyle: vars.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
  });

  return async function saveFile(filename: string, data: string) {
    const key = buildCacheKey(folder, filename);
    await s3.send(
      new PutObjectCommand({
        Bucket: vars.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: "text/html",
      }),
    );
    console.info(`Saved ${accessHost}/${key}.`);
  };
}

/** Supabase 走 Storage REST API，与 Worker 侧 SupabaseObjectStorage 保持一致 */
function createSupabaseWriter(env: NodeJS.ProcessEnv, folder: string) {
  const baseUrl = `${(env.SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1`;
  const bucket = env.SUPABASE_STORAGE_BUCKET || "";
  const apiKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

  return async function saveFile(filename: string, data: string) {
    const key = buildCacheKey(folder, filename);
    const objectPath = `${bucket}/${encodeKeyPath(key)}`;

    // 与 Worker 侧一致：只有 legacy JWT 才发 Authorization 头
    const headers: Record<string, string> = {
      apikey: apiKey,
      "Content-Type": "text/html",
      "x-upsert": "true",
    };
    if (apiKey.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/object/${objectPath}`, {
      method: "POST",
      headers,
      body: data,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to upload to Supabase Storage: ${response.status} ${await response.text()}`,
      );
    }

    const publicUrl = env.SUPABASE_STORAGE_PUBLIC === "true"
      ? `${baseUrl}/object/public/${objectPath}`
      : `${baseUrl}/object/${objectPath}`;
    console.info(`Saved ${publicUrl}.`);
  };
}

/** 分段编码，保留目录结构的同时防路径穿越 */
function encodeKeyPath(key: string) {
  return key
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
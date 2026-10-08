/**
 * 首页顶部相册轮播（前端部分）：演示插槽（below-header）、设置项声明、
 * 读取自身设置（`/api/plugins/photo-album/config`）。
 * 设置存在 `serverConfig` 的 `photo-album.*` 键，可公开读取的键由服务端 `publicSettings` 决定。
 */

import { useEffect, useState } from "react";
import type { FrontendPlugin } from "../../src/plugins/registry";

/** 一张图片。url 可以是上传后的地址，也可以是外部图床 */
interface AlbumImage {
  url: string;
  /** 可选的说明文字 */
  caption?: string;
}

const CONFIG_URL = '/api/plugins/photo-album/config';

async function fetchConfig(): Promise<{
  images: AlbumImage[];
  interval: number;
  height: number;
}> {
  const res = await fetch(CONFIG_URL);
  if (!res.ok) return { images: [], interval: 0, height: 0 };

  const body = (await res.json()) as {
    values?: Record<string, string>;
  };
  const values = body.values ?? {};

  // images 存成逗号分隔的 URL 串；caption 单独存，按下标对齐
  const urls = (values.images ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const captions = (values.captions ?? '').split('|').map((s) => s.trim());

  return {
    images: urls.map((url, i) => ({ url, caption: captions[i] || '' })),
    // 配置存的是字符串，取不到或非法时用默认值
    interval: Number(values.interval) > 0 ? Number(values.interval) : 5000,
    height: Number(values.height) > 0 ? Number(values.height) : 260,
  };
}

function AlbumCarousel() {
  const [images, setImages] = useState<AlbumImage[]>([]);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [height, setHeight] = useState(260);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchConfig()
      .then((cfg) => {
        if (cancelled) return;
        setImages(cfg.images);
        setIntervalMs(cfg.interval);
        setHeight(cfg.height);
      })
      .catch(() => {
        // 配置拉取失败不该让页面崩，静默不显示相册
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 自动轮播。只有一张图时不需要定时器
  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [images.length, intervalMs]);

  // 图片全挂了就把相册收起来，不留一个破图
  const visible = images.filter((img) => img.url && !failed);
  if (visible.length === 0) return null;

  const current = visible[index % visible.length];

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: `${height}px` }}
      aria-label="Photo album"
    >
      <div className="relative h-full w-full">
        {visible.map((img, i) => (
          <img
            key={img.url}
            src={img.url}
            alt={img.caption || `Album image ${i + 1}`}
            onError={() => setFailed(true)}
            className={
              i === index % visible.length
                ? 'absolute inset-0 h-full w-full object-cover'
                : 'hidden'
            }
          />
        ))}

        {current.caption && visible.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <p className="text-sm text-white">{current.caption}</p>
          </div>
        )}

        {/* 指示点：只在多张图时显示 */}
        {visible.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {visible.map((img, i) => (
              <button
                key={img.url}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                onClick={() => setIndex(i)}
                className={
                  i === index % visible.length
                    ? 'h-1.5 w-1.5 rounded-full bg-white'
                    : 'h-1.5 w-1.5 rounded-full bg-white/50'
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const plugin: FrontendPlugin = {
  manifest: {
    name: 'photo-album',
    displayName: '相册轮播',
    version: '1.0.0',
    description: '在页头导航下方展示图片轮播。图片可上传或填网址',
  },

  // 没有独立页面，只挂在插槽上
  pages: [],

  slots: [
    {
      Component: AlbumCarousel,
      slot: 'below-header',
      // 只在首页显示；改路径可换位置，删掉 onlyPaths 则所有页面出现
      onlyPaths: ['/'],
    },
  ],

  // 后台设置页据此自动生成表单
  settings: [
    {
      key: 'images',
      label: '图片',
      description: '可上传图片，或直接填写图片网址',
      field: { type: 'imageList', maxItems: 20 },
      defaultValue: [],
    },
    {
      key: 'captions',
      label: '图片说明',
      description: '每张图的说明文字，用 | 分隔。留空则不显示',
      field: { type: 'stringList' },
      defaultValue: '',
    },
    {
      key: 'interval',
      label: '切换间隔（毫秒）',
      description: '两张图之间的停留时间',
      field: { type: 'number', min: 1000, max: 60000, step: 500 },
      defaultValue: 5000,
    },
    {
      key: 'height',
      label: '展示高度（像素）',
      description: '轮播区域的高度',
      field: { type: 'number', min: 120, max: 800, step: 20 },
      defaultValue: 260,
    },
  ],
};

export default plugin;

import { client } from "../app/runtime";
import { encodeBlurhash } from "./blurhash";

export const DEFAULT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

export type UploadedImageResult = {
  url: string;
  blurhash?: string;
  width?: number;
  height?: number;
};

type ImageMetadata = {
  blurhash?: string;
  width?: number;
  height?: number;
};

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function toPositiveInteger(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function attachImageMetadataToUrl(url: string, metadata: ImageMetadata = {}) {
  const { blurhash, width, height } = metadata;
  if (!blurhash && !width && !height) {
    return url;
  }

  const [baseUrl, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);
  if (blurhash) {
    params.set("blurhash", blurhash);
  }
  if (width) {
    params.set("width", String(width));
  }
  if (height) {
    params.set("height", String(height));
  }
  return `${baseUrl}#${params.toString()}`;
}

export function parseImageUrlMetadata(url?: string | null) {
  if (!url) {
    return {
      src: "",
      blurhash: undefined as string | undefined,
    };
  }

  const [src, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);

  return {
    src,
    blurhash: params.get("blurhash") || undefined,
    width: toPositiveInteger(params.get("width")),
    height: toPositiveInteger(params.get("height")),
  };
}

export function stripImageUrlMetadata(url?: string | null) {
  return parseImageUrlMetadata(url).src;
}

export function buildMarkdownImage(fileName: string, url: string, metadata: ImageMetadata = {}) {
  const safeAlt = fileName.replace(/[[\]]/g, "");
  const safeUrl = url.replace(/\s/g, "%20");
  return `![${safeAlt}](${attachImageMetadataToUrl(safeUrl, metadata)})\n`;
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to load image"));
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function generateImageMetadata(file: File) {
  if (!isImageFile(file)) {
    return {};
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return {};
  }

  const scale = Math.min(1, 48 / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {};
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    blurhash: encodeBlurhash(imageData.data, width, height, 4, 3),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export async function uploadImageFile(file: File): Promise<UploadedImageResult> {
  const [uploadResult, metadataResult] = await Promise.allSettled([
    client.storage.upload(file, file.name),
    generateImageMetadata(file),
  ]);

  if (uploadResult.status === "rejected") {
    throw uploadResult.reason instanceof Error
      ? uploadResult.reason
      : new Error("Upload failed");
  }

  const { data, error } = uploadResult.value;
  if (error) {
    throw new Error(error.value);
  }

  const url =
    typeof data === "string"
      ? data
      : data?.url;

  if (!url) {
    throw new Error("Invalid upload response");
  }

  return {
    url,
    ...(metadataResult.status === "fulfilled" ? metadataResult.value : {}),
  };
}

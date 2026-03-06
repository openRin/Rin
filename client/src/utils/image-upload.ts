import { client } from "../app/runtime";
import { encodeBlurhash } from "./blurhash";

export const DEFAULT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

export type UploadedImageResult = {
  url: string;
  blurhash?: string;
};

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function attachBlurhashToImageUrl(url: string, blurhash?: string) {
  if (!blurhash) {
    return url;
  }

  const [baseUrl, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);
  params.set("blurhash", blurhash);
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
  };
}

export function stripImageUrlMetadata(url?: string | null) {
  return parseImageUrlMetadata(url).src;
}

export function buildMarkdownImage(fileName: string, url: string, blurhash?: string) {
  const safeAlt = fileName.replace(/[[\]]/g, "");
  const safeUrl = url.replace(/\s/g, "%20");
  return `![${safeAlt}](${attachBlurhashToImageUrl(safeUrl, blurhash)})\n`;
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

export async function generateImageBlurhash(file: File) {
  if (!isImageFile(file)) {
    return undefined;
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return undefined;
  }

  const scale = Math.min(1, 48 / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return undefined;
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return encodeBlurhash(imageData.data, width, height, 4, 3);
}

export async function uploadImageFile(file: File): Promise<UploadedImageResult> {
  const [uploadResult, blurhashResult] = await Promise.allSettled([
    client.storage.upload(file, file.name),
    generateImageBlurhash(file),
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
    blurhash: blurhashResult.status === "fulfilled" ? blurhashResult.value : undefined,
  };
}

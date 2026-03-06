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

export function buildMarkdownImage(fileName: string, url: string, blurhash?: string) {
  const safeAlt = fileName.replace(/[[\]]/g, "");
  const safeUrl = url.replace(/\s/g, "%20");
  const title = blurhash ? ` "blurhash:${blurhash}"` : "";
  return `![${safeAlt}](${safeUrl}${title})\n`;
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

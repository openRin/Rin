import type { ImgHTMLAttributes } from "react";
import { useImageLoadState } from "../utils/use-image-load-state";

type ImageWithFallbackProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "className" | "onError" | "onLoad" | "src"
> & {
  className?: string;
  imageClassName?: string;
  src?: string | null;
};

export function ImageWithFallback({
  alt = "",
  className = "",
  imageClassName = "",
  src,
  ...props
}: ImageWithFallbackProps) {
  const normalizedSrc = src?.trim() || undefined;
  const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(normalizedSrc);
  const showFallback = !normalizedSrc || failed;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${loaded && !failed ? "bg-transparent" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"} ${className}`}
    >
      <span
        aria-label={showFallback && alt ? alt : undefined}
        aria-hidden={showFallback ? undefined : true}
        role={showFallback && alt ? "img" : undefined}
        className={`flex h-full w-full items-center justify-center transition-opacity ${loaded && !failed ? "opacity-0" : "opacity-100"}`}
      >
        <i className="ri-image-line text-[0.9em]" aria-hidden="true" />
      </span>
      {normalizedSrc ? (
        <img
          {...props}
          ref={imageRef}
          src={normalizedSrc}
          alt={failed ? "" : alt}
          onLoad={onLoad}
          onError={onError}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${failed ? "opacity-0" : "opacity-100"} ${imageClassName}`}
        />
      ) : null}
    </span>
  );
}

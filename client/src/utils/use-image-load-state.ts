import { useEffect, useRef, useState } from "react";

export function useImageLoadState(src?: string) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);

    const image = imageRef.current;
    if (!src || !image || !image.complete) {
      return;
    }

    if (image.naturalWidth > 0) {
      setLoaded(true);
      return;
    }

    setFailed(true);
  }, [src]);

  return {
    failed,
    imageRef,
    loaded,
    onError: () => {
      setLoaded(false);
      setFailed(true);
    },
    onLoad: () => {
      setLoaded(true);
      setFailed(false);
    },
  };
}

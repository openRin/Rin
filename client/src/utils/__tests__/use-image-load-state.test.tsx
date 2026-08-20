import "../../test/setup";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it } from "bun:test";
import { useImageLoadState } from "../use-image-load-state";

afterEach(() => {
  cleanup();
});

function TestImage({ src, complete, naturalWidth }: { src: string; complete: boolean; naturalWidth: number }) {
  const { imageRef, loaded, failed, onLoad, onError } = useImageLoadState(src);

  return (
    <>
      <div data-testid="status">{JSON.stringify({ failed, loaded })}</div>
      <img
        ref={(node) => {
          (imageRef as MutableRefObject<HTMLImageElement | null>).current = node;
          if (!node) {
            return;
          }
          Object.defineProperty(node, "complete", {
            configurable: true,
            get: () => complete,
          });
          Object.defineProperty(node, "naturalWidth", {
            configurable: true,
            get: () => naturalWidth,
          });
        }}
        src={src}
        alt=""
        onLoad={onLoad}
        onError={onError}
      />
    </>
  );
}

describe("useImageLoadState", () => {
  it("marks a cached image as loaded after src changes", async () => {
    const { getByTestId, rerender } = render(<TestImage src="https://example.com/a.png" complete={false} naturalWidth={0} />);

    expect(getByTestId("status").textContent).toBe('{"failed":false,"loaded":false}');

    rerender(<TestImage src="https://example.com/b.png" complete={true} naturalWidth={640} />);

    await waitFor(() => {
      expect(getByTestId("status").textContent).toBe('{"failed":false,"loaded":true}');
    });
  });

  it("marks a completed broken image as failed", async () => {
    const { getByTestId } = render(<TestImage src="https://example.com/broken.png" complete={true} naturalWidth={0} />);

    await waitFor(() => {
      expect(getByTestId("status").textContent).toBe('{"failed":true,"loaded":false}');
    });
  });
});

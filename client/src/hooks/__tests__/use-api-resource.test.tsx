import "../../test/setup";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { useCallback } from "react";
import { useApiResource } from "../use-api-resource";

describe('useApiResource', () => {
  it('loads data and exposes a stable reload action', async () => {
    let calls = 0;
    const { result } = renderHook(() => {
      const load = useCallback(async () => ({ data: { calls: ++calls } }), []);
      return useApiResource(load);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ calls: 1 });

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toEqual({ calls: 2 });
  });

  it('normalizes API and thrown errors into one state', async () => {
    const { result, rerender } = renderHook(
      ({ failWithThrow }: { failWithThrow: boolean }) => {
        const load = useCallback(async () => {
          if (failWithThrow) {
            throw new Error('Network unavailable');
          }
          return { error: { status: 500, value: 'Server unavailable' } };
        }, [failWithThrow]);
        return useApiResource(load);
      },
      { initialProps: { failWithThrow: false } },
    );

    await waitFor(() => expect(result.current.error).toBe('Server unavailable'));

    rerender({ failWithThrow: true });
    await waitFor(() => expect(result.current.error).toBe('Network unavailable'));
  });
});

import type { ApiResponse } from "@rin/api";
import { useCallback, useEffect, useRef, useState } from "react";

export type ApiResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export function useApiResource<T>(load: () => Promise<ApiResponse<T>>) {
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [state, setState] = useState<ApiResourceState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const response = await load();
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      if (response.error) {
        const errorMessage = response.error.value;
        setState((current) => ({ ...current, error: errorMessage, loading: false }));
        return null;
      }

      const data = response.data ?? null;
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ ...current, error: message, loading: false }));
      return null;
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

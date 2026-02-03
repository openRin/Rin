import { useState, useCallback, useRef, useEffect } from 'react';
import { parseApiError, isNetworkError, isAuthError, getUserFriendlyMessage, AppError, isNotFoundError } from '../components/error-boundary';

// ============================================================================
// Types
// ============================================================================

export interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

export interface UseAsyncActions<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

export type UseAsyncReturn<T> = UseAsyncState<T> & UseAsyncActions<T>;

export interface UseAsyncOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: AppError) => void;
  immediate?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

// ============================================================================
// useAsync Hook - For handling async operations with error handling
// ============================================================================

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T> {
  const { onSuccess, onError, immediate = false, retryCount = 0, retryDelay = 1000 } = options;
  
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  
  const retryCountRef = useRef(0);
  const lastArgsRef = useRef<any[]>([]);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      lastArgsRef.current = args;
      retryCountRef.current = 0;
      
      setState((prev) => ({ ...prev, loading: true, error: null }));
      
      try {
        const data = await asyncFunction(...args);
        
        if (isMountedRef.current) {
          setState({ data, loading: false, error: null });
          onSuccess?.(data);
        }
        
        return data;
      } catch (error) {
        const parsedError = parseApiError(error);
        
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, loading: false, error: parsedError }));
          onError?.(parsedError);
        }
        
        return null;
      }
    },
    [asyncFunction, onSuccess, onError]
  );
  
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
    retryCountRef.current = 0;
  }, []);
  
  const retry = useCallback(async (): Promise<T | null> => {
    if (retryCountRef.current < retryCount) {
      retryCountRef.current++;
      
      // Delay before retry
      await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCountRef.current));
      
      return execute(...lastArgsRef.current);
    }
    
    return null;
  }, [execute, retryCount, retryDelay]);
  
  // Execute immediately if option is set
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);
  
  return {
    ...state,
    execute,
    reset,
    retry,
  };
}

// ============================================================================
// useApi Hook - For API calls with automatic error handling
// ============================================================================

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<{ data?: T; error?: any }>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T> {
  const { onSuccess, onError, immediate = false, retryCount = 0, retryDelay = 1000 } = options;
  
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  
  const retryCountRef = useRef(0);
  const lastArgsRef = useRef<any[]>([]);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      lastArgsRef.current = args;
      retryCountRef.current = 0;
      
      setState((prev) => ({ ...prev, loading: true, error: null }));
      
      try {
        const response = await apiFunction(...args);
        
        if (response.error) {
          throw response.error;
        }
        
        if (isMountedRef.current) {
          setState({ data: response.data || null, loading: false, error: null });
          onSuccess?.(response.data);
        }
        
        return response.data || null;
      } catch (error) {
        const parsedError = parseApiError(error);
        
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, loading: false, error: parsedError }));
          onError?.(parsedError);
        }
        
        return null;
      }
    },
    [apiFunction, onSuccess, onError]
  );
  
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
    retryCountRef.current = 0;
  }, []);
  
  const retry = useCallback(async (): Promise<T | null> => {
    if (retryCountRef.current < retryCount) {
      retryCountRef.current++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCountRef.current));
      return execute(...lastArgsRef.current);
    }
    return null;
  }, [execute, retryCount, retryDelay]);
  
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);
  
  return {
    ...state,
    execute,
    reset,
    retry,
  };
}

// ============================================================================
// useErrorHandler Hook - For centralized error handling
// ============================================================================

export interface ErrorHandlerOptions {
  onNetworkError?: () => void;
  onAuthError?: () => void;
  onNotFoundError?: () => void;
  onGenericError?: (error: AppError) => void;
  showToast?: (message: string) => void;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    onNetworkError,
    onAuthError,
    onNotFoundError,
    onGenericError,
    showToast,
  } = options;
  
  const handleError = useCallback(
    (error: unknown) => {
      const parsedError = parseApiError(error);
      
      if (isNetworkError(error)) {
        showToast?.('Network connection failed. Please check your internet connection.');
        onNetworkError?.();
        return;
      }
      
      if (isAuthError(error)) {
        showToast?.('Your session has expired. Please sign in again.');
        onAuthError?.();
        return;
      }
      
      if (isNotFoundError(error)) {
        showToast?.('The requested content was not found.');
        onNotFoundError?.();
        return;
      }
      
      // Generic error
      const userMessage = getUserFriendlyMessage(error);
      showToast?.(userMessage);
      onGenericError?.(parsedError);
    },
    [onNetworkError, onAuthError, onNotFoundError, onGenericError, showToast]
  );
  
  return { handleError };
}

// ============================================================================
// useRetry Hook - For retry logic
// ============================================================================

export interface UseRetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
  shouldRetry?: (error: any) => boolean;
}

export function useRetry<T>(
  fn: () => Promise<T>,
  options: UseRetryOptions = {}
) {
  const { maxRetries = 3, delay = 1000, backoff = 2, shouldRetry } = options;
  
  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const execute = useCallback(async (): Promise<T> => {
    setAttempt(0);
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        setAttempt(i);
        return await fn();
      } catch (error) {
        if (i === maxRetries) {
          throw error;
        }
        
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }
        
        setIsRetrying(true);
        const waitTime = delay * Math.pow(backoff, i);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        setIsRetrying(false);
      }
    }
    
    throw new Error('Retry failed');
  }, [fn, maxRetries, delay, backoff, shouldRetry]);
  
  return {
    execute,
    attempt,
    isRetrying,
  };
}

// ============================================================================
// useSafeState Hook - For state updates that won't cause memory leaks
// ============================================================================

export function useSafeState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const setSafeState = useCallback((newState: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, []);
  
  return [state, setSafeState] as const;
}

// ============================================================================
// useLoading Hook - For loading state management
// ============================================================================

export function useLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string>('');
  
  const startLoading = useCallback((text?: string) => {
    setLoadingText(text || '');
    setIsLoading(true);
  }, []);
  
  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingText('');
  }, []);
  
  return {
    isLoading,
    loadingText,
    startLoading,
    stopLoading,
  };
}

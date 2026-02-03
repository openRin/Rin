import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorPage } from '../page/error';

// ============================================================================
// Error Types
// ============================================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  details?: string;
  severity?: ErrorSeverity;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

// ============================================================================
// Error Parser
// ============================================================================

export function parseApiError(error: unknown): AppError {
  if (error && typeof error === 'object') {
    // Check if it's an API error response
    const err = error as any;
    
    if (err.error && typeof err.error === 'object') {
      return {
        message: err.error.message || 'Unknown error',
        code: err.error.code,
        status: err.error.status,
        requestId: err.error.requestId,
        details: err.error.details,
        severity: getSeverityFromStatus(err.error.status),
      };
    }
    
    // Standard error object
    if (err.message) {
      return {
        message: err.message,
        code: err.code,
        status: err.status,
        severity: getSeverityFromStatus(err.status),
      };
    }
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      severity: 'medium',
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    severity: 'high',
  };
}

function getSeverityFromStatus(status?: number): ErrorSeverity {
  if (!status) return 'medium';
  if (status >= 500) return 'high';
  if (status >= 400) return 'medium';
  return 'low';
}

// ============================================================================
// Global Error Boundary
// ============================================================================

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error
    console.error('Global Error Boundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      // reportError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;
    
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;
    
    if (hasError) {
      if (fallback) {
        return <>{fallback}</>;
      }
      
      // Default error UI
      const errorMessage = error?.message || 'Something went wrong';
      return <ErrorPage error={errorMessage} />;
    }
    
    return <>{children}</>;
  }
}

// ============================================================================
// Route Error Boundary
// ============================================================================

export class RouteErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Route Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;
    
    if (hasError) {
      if (fallback) {
        return <>{fallback}</>;
      }
      
      return (
        <div className="w-full flex flex-col items-center justify-center p-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">
            This page failed to load
          </h2>
          <p className="text-gray-600 mb-4">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.reset}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      );
    }
    
    return <>{children}</>;
  }
}

// ============================================================================
// Component Error Boundary (for individual components)
// ============================================================================

interface ComponentErrorBoundaryProps extends ErrorBoundaryProps {
  placeholder?: ReactNode;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Component Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError } = this.state;
    const { children, placeholder } = this.props;
    
    if (hasError) {
      if (placeholder) {
        return <>{placeholder}</>;
      }
      
      return (
        <div className="p-4 border border-red-300 rounded bg-red-50">
          <p className="text-sm text-red-600">Failed to load component</p>
        </div>
      );
    }
    
    return <>{children}</>;
  }
}

// ============================================================================
// Error Boundary HOC
// ============================================================================

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <GlobalErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </GlobalErrorBoundary>
    );
  };
}

// ============================================================================
// Error Utilities
// ============================================================================

export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as any;
    return (
      err.status === 0 ||
      err.code === 'NETWORK_ERROR' ||
      err.message?.includes('network') ||
      err.message?.includes('fetch') ||
      err.message?.includes('Failed to fetch')
    );
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as any;
    return (
      err.status === 401 ||
      err.code === 'UNAUTHORIZED' ||
      err.code === 'TOKEN_EXPIRED' ||
      err.code === 'TOKEN_INVALID'
    );
  }
  return false;
}

export function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as any;
    return (
      err.status === 404 ||
      err.code === 'NOT_FOUND' ||
      err.code === 'RESOURCE_NOT_FOUND'
    );
  }
  return false;
}

export function getUserFriendlyMessage(error: unknown): string {
  const parsed = parseApiError(error);
  
  // Map error codes to user-friendly messages
  switch (parsed.code) {
    case 'UNAUTHORIZED':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_INVALID':
      return 'Please sign in to continue';
    case 'FORBIDDEN':
    case 'PERMISSION_DENIED':
      return 'You do not have permission to perform this action';
    case 'NOT_FOUND':
    case 'RESOURCE_NOT_FOUND':
      return 'The requested resource was not found';
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      return 'Please check your input and try again';
    case 'RATE_LIMITED':
      return 'Too many requests. Please try again later';
    case 'INTERNAL_ERROR':
    case 'DATABASE_ERROR':
    case 'EXTERNAL_SERVICE_ERROR':
      return 'Something went wrong on our end. Please try again later';
    default:
      return parsed.message || 'An unexpected error occurred';
  }
}

import type { Context, Middleware } from "./types";
import {
  AppError,
  isAppError,
  createErrorResponse,
  InternalServerError,
} from "../errors";

// ============================================================================
// Request ID Generation
// ============================================================================

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

// ============================================================================
// Error Handling Middleware
// ============================================================================

export function errorHandlerMiddleware(): Middleware {
  return async (context: Context, env: Env): Promise<Response | void> => {
    // Request ID is generated in the router and passed through context
    // This middleware doesn't need to do anything on the way in
    return undefined;
  };
}

// ============================================================================
// Global Error Handler
// ============================================================================

export interface ErrorLogEntry {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  errorCode: string;
  message: string;
  stack?: string;
  userAgent?: string;
  ip?: string;
}

export class ErrorLogger {
  private static logs: ErrorLogEntry[] = [];
  private static maxLogs = 100;

  static log(entry: ErrorLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Always log to console in development or for serious errors
    if (entry.statusCode >= 500) {
      console.error(`[ERROR] ${entry.method} ${entry.path} - ${entry.statusCode}`, {
        requestId: entry.requestId,
        errorCode: entry.errorCode,
        message: entry.message,
        stack: entry.stack,
      });
    }
  }

  static getRecentLogs(limit = 50): ErrorLogEntry[] {
    return this.logs.slice(-limit);
  }

  static clear(): void {
    this.logs = [];
  }
}

export function handleError(
  error: unknown,
  context: Context,
  requestId: string
): Response {
  let appError: AppError;

  if (isAppError(error)) {
    appError = error;
  } else if (error instanceof Error) {
    // Convert standard errors to AppError
    appError = new InternalServerError(error.message);
  } else {
    appError = new InternalServerError();
  }

  // Log the error
  const logEntry: ErrorLogEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    method: context.request.method,
    path: context.url.pathname,
    statusCode: appError.statusCode,
    errorCode: appError.code,
    message: appError.message,
    stack: appError.stack,
    userAgent: context.headers["user-agent"],
    ip: context.headers["cf-connecting-ip"],
  };

  ErrorLogger.log(logEntry);

  // Build response
  const errorResponse = appError.toJSON(requestId);
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  // Copy CORS headers from context if present
  context.set.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith("access-control")) {
      headers.set(key, value);
    }
  });

  return new Response(JSON.stringify(errorResponse), {
    status: appError.statusCode,
    headers,
  });
}

// ============================================================================
// Not Found Handler
// ============================================================================

export function createNotFoundHandler(): Middleware {
  return async (context: Context): Promise<Response> => {
    const requestId = generateRequestId();
    const errorResponse = {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${context.request.method} ${context.url.pathname} not found`,
        requestId,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// ============================================================================
// Async Handler Wrapper for Routes
// ============================================================================

export type RouteHandler = (context: Context) => Promise<any>;

export function asyncHandler(handler: RouteHandler): RouteHandler {
  return async (context: Context) => {
    try {
      return await handler(context);
    } catch (error) {
      // Re-throw to be caught by global error handler
      throw error;
    }
  };
}

// ============================================================================
// Safe Async Function Wrapper
// ============================================================================

export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    errorHandler?.(error);
    return null;
  }
}

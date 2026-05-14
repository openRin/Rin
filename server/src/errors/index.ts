// ============================================================================
// Error Types and Classes for Server
// ============================================================================

export type ErrorCode = 
  // 400 Bad Request
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'INVALID_INPUT'
  // 401 Unauthorized
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  // 403 Forbidden
  | 'FORBIDDEN'
  | 'PERMISSION_DENIED'
  // 404 Not Found
  | 'NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  // 409 Conflict
  | 'CONFLICT'
  | 'DUPLICATE_ENTRY'
  // 422 Unprocessable Entity
  | 'UNPROCESSABLE_ENTITY'
  // 429 Too Many Requests
  | 'RATE_LIMITED'
  | 'TOO_MANY_REQUESTS'
  // 500 Internal Server Error
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  // 503 Service Unavailable
  | 'SERVICE_UNAVAILABLE';

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId?: string;
  };
}

// ============================================================================
// Base Application Error
// ============================================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetail[];
  public readonly requestId?: string;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: ErrorDetail[],
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(requestId?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId: requestId || this.requestId,
      },
    };
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', details?: ErrorDetail[]) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired') {
    super('TOKEN_EXPIRED', message, 401);
  }
}

export class TokenInvalidError extends AppError {
  constructor(message: string = 'Invalid token') {
    super('TOKEN_INVALID', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class PermissionDeniedError extends AppError {
  constructor(message: string = 'Permission denied') {
    super('PERMISSION_DENIED', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    super('RESOURCE_NOT_FOUND', message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super('CONFLICT', message, 409);
  }
}

export class DuplicateEntryError extends AppError {
  constructor(field: string, value?: string) {
    const message = value 
      ? `${field} "${value}" already exists`
      : `${field} already exists`;
    super('DUPLICATE_ENTRY', message, 409);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable Entity') {
    super('UNPROCESSABLE_ENTITY', message, 422);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('RATE_LIMITED', message, 429);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super('INTERNAL_ERROR', message, 500, undefined, false);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error') {
    super('DATABASE_ERROR', message, 500, undefined, false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      message || `Error connecting to ${service}`,
      500,
      undefined,
      false
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super('SERVICE_UNAVAILABLE', message, 503, undefined, false);
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

export function createErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  if (isAppError(error)) {
    return error.toJSON(requestId);
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        requestId,
      },
    };
  }

  // Handle unknown errors
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  };
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

export type AsyncHandler<T = Response> = (
  ...args: any[]
) => Promise<T>;

export function catchAsync<T>(
  fn: AsyncHandler<T>
): AsyncHandler<T | Response> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error;
    }
  };
}

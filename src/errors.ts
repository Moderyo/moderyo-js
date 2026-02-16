/**
 * Moderyo SDK Error Classes
 *
 * Custom error types for different failure scenarios.
 */

// =============================================================================
// Base Error
// =============================================================================

export class ModeryoError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly requestId?: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      requestId?: string;
      cause?: Error;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ModeryoError';
    this.code = options?.code ?? 'MODERYO_ERROR';
    this.statusCode = options?.statusCode;
    this.requestId = options?.requestId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// =============================================================================
// Concrete Errors
// =============================================================================

/** API key missing, invalid, or expired (401) */
export class AuthenticationError extends ModeryoError {
  constructor(message = 'Invalid or missing API key', options?: { requestId?: string }) {
    super(message, { code: 'AUTHENTICATION_ERROR', statusCode: 401, requestId: options?.requestId });
    this.name = 'AuthenticationError';
  }
}

/** Rate limit exceeded (429) */
export class RateLimitError extends ModeryoError {
  public readonly retryAfter: number;
  public readonly limit: number;
  public readonly remaining: number;
  public readonly reset: Date;

  constructor(
    message = 'Rate limit exceeded',
    options: { retryAfter: number; limit?: number; remaining?: number; reset?: Date; requestId?: string },
  ) {
    super(message, { code: 'RATE_LIMIT_ERROR', statusCode: 429, requestId: options?.requestId });
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
    this.limit = options.limit ?? 0;
    this.remaining = options.remaining ?? 0;
    this.reset = options.reset ?? new Date(Date.now() + options.retryAfter);
  }
}

/** Validation error (400) */
export class ValidationError extends ModeryoError {
  public readonly field?: string;
  public readonly details?: Record<string, string>;

  constructor(message: string, options?: { field?: string; details?: Record<string, string>; requestId?: string }) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, requestId: options?.requestId });
    this.name = 'ValidationError';
    this.field = options?.field;
    this.details = options?.details;
  }
}

/** Generic API error (4xx / 5xx) */
export class APIError extends ModeryoError {
  public readonly response?: unknown;

  constructor(message: string, options: { statusCode: number; response?: unknown; requestId?: string }) {
    super(message, { code: 'API_ERROR', statusCode: options.statusCode, requestId: options.requestId });
    this.name = 'APIError';
    this.response = options.response;
  }
}

/** Network / timeout error */
export class NetworkError extends ModeryoError {
  public readonly timeout: boolean;

  constructor(message = 'Network error occurred', options?: { timeout?: boolean; cause?: Error; requestId?: string }) {
    super(message, {
      code: options?.timeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'NetworkError';
    this.timeout = options?.timeout ?? false;
  }
}

/** Monthly quota exceeded (402) */
export class QuotaExceededError extends ModeryoError {
  public readonly currentUsage: number;
  public readonly limit: number;
  public readonly resetDate?: Date;

  constructor(
    message = 'Monthly quota exceeded',
    options: { currentUsage: number; limit: number; resetDate?: Date; requestId?: string },
  ) {
    super(message, { code: 'QUOTA_EXCEEDED_ERROR', statusCode: 402, requestId: options.requestId });
    this.name = 'QuotaExceededError';
    this.currentUsage = options.currentUsage;
    this.limit = options.limit;
    this.resetDate = options.resetDate;
  }
}

// =============================================================================
// Helpers
// =============================================================================

export function isModeryoError(error: unknown): error is ModeryoError {
  return error instanceof ModeryoError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError && !error.timeout) return true;
  if (error instanceof APIError && error.statusCode !== undefined && error.statusCode >= 500) return true;
  return false;
}

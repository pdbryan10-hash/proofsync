import { ExceptionType, ExceptionSeverity } from '@/lib/domain/enums';

/**
 * Typed application errors. Each carries enough context to be translated into
 * (a) a user-readable Exception record, (b) a technical audit event, and
 * (c) a retry-eligibility decision.
 */
export abstract class IntegrationError extends Error {
  abstract readonly code: string;
  abstract readonly exceptionType: ExceptionType;
  abstract readonly severity: ExceptionSeverity;
  /** Whether an automatic retry could plausibly succeed. */
  abstract readonly retryable: boolean;
  /** Optional upstream HTTP status, when the error originated from an API call. */
  readonly httpStatus?: number;

  protected constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = new.target.name;
    this.httpStatus = httpStatus;
  }
}

export class IntegrationAuthenticationError extends IntegrationError {
  readonly code = 'AUTH_FAILED';
  readonly exceptionType = ExceptionType.API_AUTHENTICATION_FAILED;
  readonly severity = ExceptionSeverity.HIGH;
  readonly retryable = false;
  constructor(message = 'Provider authentication failed', httpStatus = 401) {
    super(message, httpStatus);
  }
}

export class IntegrationTimeoutError extends IntegrationError {
  readonly code = 'TIMEOUT';
  readonly exceptionType = ExceptionType.API_UNAVAILABLE;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = true;
  constructor(message = 'Provider request timed out') {
    super(message);
  }
}

export class IntegrationUnavailableError extends IntegrationError {
  readonly code = 'UNAVAILABLE';
  readonly exceptionType = ExceptionType.API_UNAVAILABLE;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = true;
  constructor(message = 'Provider temporarily unavailable', httpStatus = 503) {
    super(message, httpStatus);
  }
}

export class IntegrationRateLimitError extends IntegrationError {
  readonly code = 'RATE_LIMIT';
  readonly exceptionType = ExceptionType.API_RATE_LIMIT;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = true;
  constructor(message = 'Provider rate limit reached', httpStatus = 429) {
    super(message, httpStatus);
  }
}

export class TargetNotFoundError extends IntegrationError {
  readonly code = 'TARGET_NOT_FOUND';
  readonly exceptionType = ExceptionType.TARGET_JOB_NOT_FOUND;
  readonly severity = ExceptionSeverity.HIGH;
  readonly retryable = false;
  constructor(reference: string) {
    super(`No Concerto job found for reference ${reference}`);
  }
}

export class DuplicateTargetError extends IntegrationError {
  readonly code = 'DUPLICATE_TARGET';
  readonly exceptionType = ExceptionType.DUPLICATE_TARGET_MATCH;
  readonly severity = ExceptionSeverity.HIGH;
  readonly retryable = false;
  constructor(reference: string, count: number) {
    super(`${count} Concerto jobs matched reference ${reference}; refusing to update ambiguously`);
  }
}

export class MissingReferenceError extends IntegrationError {
  readonly code = 'MISSING_REFERENCE';
  readonly exceptionType = ExceptionType.MISSING_CONCERTO_REFERENCE;
  readonly severity = ExceptionSeverity.HIGH;
  readonly retryable = false;
  constructor(message = 'No Concerto job reference is stored against this Joblogic job') {
    super(message);
  }
}

export class ValidationError extends IntegrationError {
  readonly code = 'VALIDATION';
  readonly exceptionType = ExceptionType.VALIDATION_ERROR;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = false;
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class RequiredFieldMissingError extends IntegrationError {
  readonly code = 'REQUIRED_FIELD_MISSING';
  readonly exceptionType = ExceptionType.REQUIRED_FIELD_MISSING;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = false;
  constructor(fields: string[]) {
    super(`Required completion field(s) missing: ${fields.join(', ')}`);
  }
}

export class DocumentTransferError extends IntegrationError {
  readonly code = 'DOCUMENT_TRANSFER';
  readonly exceptionType = ExceptionType.DOCUMENT_UPLOAD_FAILED;
  readonly severity = ExceptionSeverity.MEDIUM;
  readonly retryable = true;
  readonly filename: string;
  constructor(filename: string, message?: string) {
    super(message ?? `Failed to transfer document ${filename}`);
    this.filename = filename;
  }
}

/**
 * Central retry-eligibility decision. Falls back to HTTP-status heuristics for
 * non-typed errors so partner SDK errors are handled gracefully.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof IntegrationError) return error.retryable;

  const status = extractHttpStatus(error);
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('network')
  );
}

function extractHttpStatus(error: unknown): number | undefined {
  if (error instanceof IntegrationError) return error.httpStatus;
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { status?: unknown; statusCode?: unknown });
    if (typeof candidate.status === 'number') return candidate.status;
    if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  }
  return undefined;
}

export function toExceptionType(error: unknown): ExceptionType {
  return error instanceof IntegrationError ? error.exceptionType : ExceptionType.UNKNOWN;
}

export function toExceptionSeverity(error: unknown): ExceptionSeverity {
  return error instanceof IntegrationError ? error.severity : ExceptionSeverity.MEDIUM;
}

export function toErrorCode(error: unknown): string {
  if (error instanceof IntegrationError) return error.code;
  return 'UNKNOWN';
}

/** Safe, user-presentable message. Never leaks provider internals or secrets. */
export function toSafeMessage(error: unknown): string {
  if (error instanceof IntegrationError) return error.message;
  return 'An unexpected error occurred while contacting the integration.';
}

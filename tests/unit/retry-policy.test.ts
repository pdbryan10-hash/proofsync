import { describe, it, expect } from 'vitest';
import { evaluateRetry, MAX_SYNC_ATTEMPTS } from '@/lib/sync/retry-policy';
import {
  IntegrationUnavailableError,
  IntegrationRateLimitError,
  MissingReferenceError,
  DuplicateTargetError,
  isRetryableError,
} from '@/lib/errors/integration-errors';

describe('isRetryableError', () => {
  it('marks transient integration errors retryable', () => {
    expect(isRetryableError(new IntegrationUnavailableError())).toBe(true);
    expect(isRetryableError(new IntegrationRateLimitError())).toBe(true);
  });

  it('marks structural errors non-retryable', () => {
    expect(isRetryableError(new MissingReferenceError())).toBe(false);
    expect(isRetryableError(new DuplicateTargetError('CON-1', 2))).toBe(false);
  });

  it('falls back to HTTP status heuristics for untyped errors', () => {
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });
});

describe('evaluateRetry', () => {
  it('schedules a retry for a transient error under the cap', () => {
    const d = evaluateRetry(new IntegrationUnavailableError(), 1);
    expect(d.shouldRetry).toBe(true);
    expect(d.nextAttempt).toBe(2);
  });

  it('never retries a non-retryable error', () => {
    const d = evaluateRetry(new MissingReferenceError(), 1);
    expect(d.shouldRetry).toBe(false);
  });

  it('stops at the attempt ceiling', () => {
    const d = evaluateRetry(new IntegrationUnavailableError(), MAX_SYNC_ATTEMPTS);
    expect(d.shouldRetry).toBe(false);
    expect(d.reason).toMatch(/maximum/i);
  });
});

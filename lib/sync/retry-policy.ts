import { isRetryableError } from '@/lib/errors/integration-errors';

export const MAX_SYNC_ATTEMPTS = 4;

/** Exponential backoff (ms) with a sensible ceiling. */
const BACKOFF_SCHEDULE_MS = [0, 30_000, 120_000, 600_000];

export interface RetryDecision {
  shouldRetry: boolean;
  nextAttempt: number;
  delayMs: number;
  reason: string;
}

/**
 * Decides whether a failed sync attempt is eligible for another automatic try.
 * Never recommends retry for non-retryable errors (e.g. missing reference,
 * duplicate match) or once the attempt ceiling is reached.
 */
export function evaluateRetry(
  error: unknown,
  currentAttempt: number,
): RetryDecision {
  const nextAttempt = currentAttempt + 1;

  if (!isRetryableError(error)) {
    return {
      shouldRetry: false,
      nextAttempt,
      delayMs: 0,
      reason: 'Error is not automatically retryable — requires manual review.',
    };
  }

  if (currentAttempt >= MAX_SYNC_ATTEMPTS) {
    return {
      shouldRetry: false,
      nextAttempt,
      delayMs: 0,
      reason: `Maximum of ${MAX_SYNC_ATTEMPTS} attempts reached.`,
    };
  }

  const delayMs =
    BACKOFF_SCHEDULE_MS[currentAttempt] ??
    BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]!;

  return {
    shouldRetry: true,
    nextAttempt,
    delayMs,
    reason: `Transient error — retry ${nextAttempt}/${MAX_SYNC_ATTEMPTS} scheduled.`,
  };
}

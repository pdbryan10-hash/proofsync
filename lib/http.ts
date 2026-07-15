import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { IntegrationError, toSafeMessage } from '@/lib/errors/integration-errors';

/** Consistent JSON success envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

/** Consistent JSON error envelope with safe, non-leaking messages (§18). */
export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Translates thrown errors into safe API responses. */
export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail('Validation failed', 422, { issues: error.flatten().fieldErrors });
  }
  if (error instanceof IntegrationError) {
    return fail(toSafeMessage(error), error.httpStatus ?? 502, { code: error.code });
  }
  // Never echo internal error detail to the client.
  console.error('[api] unhandled error', error);
  return fail('An unexpected error occurred.', 500);
}

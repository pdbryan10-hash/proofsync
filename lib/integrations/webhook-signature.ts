import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 webhook signature verification abstraction.
 *
 * The exact header name and signing scheme used by Joblogic must be confirmed
 * during the integration workshop (see docs/integration-checklist.md). This
 * implementation is the common `sha256=<hex>` convention and is isolated here so
 * the scheme is a single-file change.
 *
 * If no secret is configured (demo / mock), verification is treated as a no-op
 * and returns true — but the webhook route logs that signing is not enforced.
 */
export function verifyHmacSignature(params: {
  rawBody: string;
  signature: string | null;
  secret: string;
}): boolean {
  const { rawBody, signature, secret } = params;

  if (!secret) return true; // not configured — enforcement disabled (logged upstream)
  if (!signature) return false;

  const provided = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}

export function signHmac(rawBody: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

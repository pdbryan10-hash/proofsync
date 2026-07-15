import { describe, it, expect } from 'vitest';
import { isValidConcertoReference, joblogicWebhookSchema, isAllowedDocument } from '@/lib/domain/validation';
import { buildIdempotencyKey } from '@/lib/sync/idempotency';
import { verifyHmacSignature, signHmac } from '@/lib/integrations/webhook-signature';

describe('isValidConcertoReference', () => {
  it('accepts the demo format', () => {
    expect(isValidConcertoReference('CON-284731')).toBe(true);
    expect(isValidConcertoReference('CON-9999')).toBe(true);
  });
  it('rejects malformed references', () => {
    expect(isValidConcertoReference('284731')).toBe(false);
    expect(isValidConcertoReference('CON-')).toBe(false);
    expect(isValidConcertoReference(null)).toBe(false);
    expect(isValidConcertoReference('JOB-284731')).toBe(false);
  });
});

describe('joblogicWebhookSchema', () => {
  it('requires a joblogic job id and defaults the event type', () => {
    const parsed = joblogicWebhookSchema.parse({ joblogicJobId: 'JL-1' });
    expect(parsed.eventType).toBe('job.completed');
  });
  it('rejects a payload without a job id', () => {
    expect(joblogicWebhookSchema.safeParse({}).success).toBe(false);
  });
});

describe('buildIdempotencyKey', () => {
  it('prefers the source event id', () => {
    expect(buildIdempotencyKey({ sourceEventId: 'evt-1', joblogicJobId: 'JL-1', eventType: 'x' })).toBe('evt:evt-1');
  });
  it('derives a stable key without an event id', () => {
    const a = buildIdempotencyKey({ joblogicJobId: 'JL-1', eventType: 'job.completed', completionVersion: '5' });
    const b = buildIdempotencyKey({ joblogicJobId: 'JL-1', eventType: 'job.completed', completionVersion: '5' });
    expect(a).toBe(b);
    expect(a).toBe('job:JL-1:job.completed:5');
  });
});

describe('webhook signature', () => {
  it('round-trips a valid HMAC signature', () => {
    const body = JSON.stringify({ joblogicJobId: 'JL-1' });
    const sig = signHmac(body, 'secret');
    expect(verifyHmacSignature({ rawBody: body, signature: sig, secret: 'secret' })).toBe(true);
  });
  it('rejects a tampered body', () => {
    const sig = signHmac('{"a":1}', 'secret');
    expect(verifyHmacSignature({ rawBody: '{"a":2}', signature: sig, secret: 'secret' })).toBe(false);
  });
  it('treats an unset secret as unenforced (demo mode)', () => {
    expect(verifyHmacSignature({ rawBody: 'x', signature: null, secret: '' })).toBe(true);
  });
});

describe('isAllowedDocument', () => {
  it('accepts a normal PDF', () => {
    expect(isAllowedDocument('application/pdf', 100_000)).toBe(true);
  });
  it('rejects oversized files and disallowed types', () => {
    expect(isAllowedDocument('application/pdf', 999_000_000)).toBe(false);
    expect(isAllowedDocument('application/x-msdownload', 1000)).toBe(false);
  });
});

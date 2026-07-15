import { prisma } from '@/lib/db/prisma';
import { ok, fail } from '@/lib/http';
import { joblogicWebhookSchema } from '@/lib/domain/validation';
import { createJoblogicConnector } from '@/lib/integrations/joblogic/connector';
import { getJoblogicCredentials } from '@/lib/config';
import { buildIdempotencyKey, isAlreadyProcessed } from '@/lib/sync/idempotency';
import { getSyncDispatcher } from '@/lib/sync/dispatcher';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/joblogic — inbound Joblogic completion event (§9).
 *
 * 1. Read raw body (needed for signature verification).
 * 2. Verify webhook authenticity if a secret is configured.
 * 3. Validate the payload (Zod).
 * 4. Extract the Joblogic job id and resolve the local job.
 * 5. Make processing idempotent (source event id / job id / completion version).
 * 6. Dispatch the sync and acknowledge.
 *
 * In production the dispatch step is queued so the endpoint returns immediately;
 * the MVP runs it inline (see SyncJobDispatcher).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  // 2. Signature verification (abstraction; enforced only when a secret is set).
  const connector = createJoblogicConnector();
  const signature = req.headers.get('x-joblogic-signature');
  const { webhookSecret } = getJoblogicCredentials();
  const signatureOk = connector.verifyWebhookSignature({
    rawBody,
    signature,
    secret: webhookSecret,
  });
  if (!signatureOk) {
    return fail('Invalid webhook signature', 401);
  }
  if (!webhookSecret) {
    console.warn('[webhook] JOBLOGIC_WEBHOOK_SECRET not set — signature enforcement disabled (demo mode).');
  }

  // 3. Validate payload.
  let payload;
  try {
    payload = joblogicWebhookSchema.parse(JSON.parse(rawBody || '{}'));
  } catch {
    return fail('Invalid webhook payload', 422);
  }

  // 4. Resolve the local job.
  const job = await prisma.job.findFirst({ where: { joblogicJobId: payload.joblogicJobId } });
  if (!job) {
    // Acknowledge to avoid provider retries, but record nothing to sync.
    return ok({ accepted: true, matched: false, message: 'No matching job for Joblogic id.' }, { status: 202 });
  }

  // 5. Idempotency short-circuit (defence-in-depth; engine also guards).
  const idempotencyKey = buildIdempotencyKey({
    sourceEventId: payload.eventId,
    joblogicJobId: payload.joblogicJobId,
    eventType: payload.eventType,
    completionVersion: payload.completionVersion ?? null,
  });
  if (await isAlreadyProcessed(idempotencyKey)) {
    return ok({ accepted: true, duplicate: true, message: 'Event already processed.' }, { status: 202 });
  }

  // 6. Dispatch.
  const dispatcher = getSyncDispatcher();
  const result = await dispatcher.dispatch({
    jobId: job.id,
    triggerType: 'WEBHOOK',
    idempotencyKey,
    sourceEventId: payload.eventId ?? null,
    eventType: payload.eventType,
    completionVersion: payload.completionVersion != null ? String(payload.completionVersion) : null,
  });

  return ok({ accepted: true, matched: true, ...result }, { status: 202 });
}

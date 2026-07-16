import { z } from 'zod';

/**
 * Zod schemas used at application boundaries (API routes, webhook ingestion,
 * form submissions). Enforce the string-literal enums that back the Prisma
 * schema and validate cross-system identifiers.
 */

/**
 * Concerto reference format. Demonstration format is `CON-` followed by 4–8
 * digits. The real format must be confirmed during the integration workshop
 * (see docs/integration-checklist.md) — centralised here so it is a one-line
 * change, not a scattered regex.
 */
export const CONCERTO_REFERENCE_REGEX = /^CON-\d{4,8}$/;

export const concertoReferenceSchema = z
  .string()
  .trim()
  .regex(CONCERTO_REFERENCE_REGEX, {
    message: 'Concerto reference must look like CON-284731',
  });

export function isValidConcertoReference(value: string | null | undefined): boolean {
  return !!value && concertoReferenceSchema.safeParse(value).success;
}

/** Inbound Joblogic completion webhook payload. */
export const joblogicWebhookSchema = z.object({
  eventId: z.string().min(1).optional(),
  eventType: z.string().min(1).default('job.completed'),
  joblogicJobId: z.string().min(1, 'joblogicJobId is required'),
  completionVersion: z.union([z.string(), z.number()]).optional(),
  occurredAt: z.string().optional(),
  signature: z.string().optional(),
});
export type JoblogicWebhookPayload = z.infer<typeof joblogicWebhookSchema>;

/** Manual sync trigger body. */
export const manualSyncSchema = z.object({
  triggerType: z.enum(['MANUAL', 'RETRY']).default('MANUAL'),
});

/** Resolve-exception body (e.g. supply a missing Concerto reference and retry). */
export const resolveExceptionSchema = z.object({
  concertoJobReference: z.string().trim().optional(),
  resolutionNotes: z.string().trim().max(2000).optional(),
  resolvedBy: z.string().trim().max(200).optional(),
  retry: z.boolean().default(true),
});
export type ResolveExceptionInput = z.infer<typeof resolveExceptionSchema>;

/** Update a client's sync policy from the settings screen. */
export const clientSyncSettingsSchema = z.object({
  syncCompletionNotes: z.boolean(),
  syncTimes: z.boolean(),
  syncCosts: z.boolean(),
  syncMaterials: z.boolean(),
  syncDocuments: z.boolean(),
  syncStatus: z.boolean(),
  requireApprovalBeforeClose: z.boolean(),
});
export type ClientSyncSettingsInput = z.infer<typeof clientSyncSettingsSchema>;

/** Toggle a field mapping active/required from the mappings screen. */
export const mappingUpdateSchema = z.object({
  active: z.boolean().optional(),
  required: z.boolean().optional(),
});

/**
 * Sales-page enquiry capture. Deliberately structured (arrays, not prose) so
 * "which client systems are you re-keying into?" aggregates into a demand signal
 * that ranks the connector roadmap.
 */
export const enquirySchema = z.object({
  name: z.string().trim().min(1, 'Please give your name').max(120),
  email: z.string().trim().email('Please give a valid work email').max(200),
  company: z.string().trim().max(160).optional(),
  sourceSystems: z.array(z.string().max(60)).max(20).default([]),
  targetSystems: z.array(z.string().max(60)).max(30).default([]),
  otherSystems: z.string().trim().max(300).optional(),
  jobsPerMonth: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  pageSource: z.string().trim().max(80).optional(),
  /// Honeypot — humans never see it, so anything here means a bot. Deliberately
  /// permissive at parse time so the route can accept-and-discard silently; a
  /// validation error would tell the bot the field matters.
  website: z.string().max(200).optional(),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

// --- File-transfer safety limits --------------------------------------------

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export function isAllowedDocument(mimeType: string, sizeBytes: number | null | undefined): boolean {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    return false;
  }
  if (sizeBytes != null && sizeBytes > MAX_DOCUMENT_BYTES) return false;
  return true;
}

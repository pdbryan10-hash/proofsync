/**
 * Domain enums.
 *
 * Modelled as `as const` string-literal unions rather than Prisma native enums
 * so the schema stays portable across SQLite (local demo) and PostgreSQL
 * (production). Zod schemas in lib/domain/validation.ts enforce these at the
 * application boundary.
 */

export const Provider = {
  JOBLOGIC: 'JOBLOGIC',
  CONCERTO: 'CONCERTO',
} as const;
export type Provider = (typeof Provider)[keyof typeof Provider];

export const ConnectionStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  DEGRADED: 'DEGRADED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
} as const;
export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  PARTIAL: 'PARTIAL',
  EXCEPTION: 'EXCEPTION',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  IGNORED: 'IGNORED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const DocumentType = {
  CERTIFICATE: 'CERTIFICATE',
  RAMS: 'RAMS',
  COMPLETION_SHEET: 'COMPLETION_SHEET',
  PHOTO: 'PHOTO',
  SERVICE_REPORT: 'SERVICE_REPORT',
  COMPLIANCE_DOCUMENT: 'COMPLIANCE_DOCUMENT',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentTransferStatus = {
  PENDING: 'PENDING',
  TRANSFERRING: 'TRANSFERRING',
  TRANSFERRED: 'TRANSFERRED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type DocumentTransferStatus =
  (typeof DocumentTransferStatus)[keyof typeof DocumentTransferStatus];

export const TransformationType = {
  DIRECT: 'DIRECT',
  DATE_FORMAT: 'DATE_FORMAT',
  DATETIME_FORMAT: 'DATETIME_FORMAT',
  MINUTES_TO_HOURS: 'MINUTES_TO_HOURS',
  NUMBER_FORMAT: 'NUMBER_FORMAT',
  CURRENCY_FORMAT: 'CURRENCY_FORMAT',
  BOOLEAN_TO_TEXT: 'BOOLEAN_TO_TEXT',
  STATUS_MAP: 'STATUS_MAP',
  CONCATENATE: 'CONCATENATE',
  CUSTOM: 'CUSTOM',
} as const;
export type TransformationType =
  (typeof TransformationType)[keyof typeof TransformationType];

export const SyncDirection = {
  JOBLOGIC_TO_CONCERTO: 'JOBLOGIC_TO_CONCERTO',
  CONCERTO_TO_JOBLOGIC: 'CONCERTO_TO_JOBLOGIC',
} as const;
export type SyncDirection = (typeof SyncDirection)[keyof typeof SyncDirection];

export const TriggerType = {
  WEBHOOK: 'WEBHOOK',
  POLLING: 'POLLING',
  MANUAL: 'MANUAL',
  RETRY: 'RETRY',
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

export const SyncRunStatus = {
  QUEUED: 'QUEUED',
  VALIDATING: 'VALIDATING',
  MATCHING: 'MATCHING',
  TRANSFORMING: 'TRANSFORMING',
  UPDATING: 'UPDATING',
  UPLOADING_DOCUMENTS: 'UPLOADING_DOCUMENTS',
  VERIFYING: 'VERIFYING',
  SUCCESS: 'SUCCESS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  EXCEPTION: 'EXCEPTION',
} as const;
export type SyncRunStatus =
  (typeof SyncRunStatus)[keyof typeof SyncRunStatus];

export const EventLevel = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;
export type EventLevel = (typeof EventLevel)[keyof typeof EventLevel];

export const ExceptionType = {
  MISSING_CONCERTO_REFERENCE: 'MISSING_CONCERTO_REFERENCE',
  TARGET_JOB_NOT_FOUND: 'TARGET_JOB_NOT_FOUND',
  DUPLICATE_TARGET_MATCH: 'DUPLICATE_TARGET_MATCH',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FIELD_VALUE: 'INVALID_FIELD_VALUE',
  DOCUMENT_UPLOAD_FAILED: 'DOCUMENT_UPLOAD_FAILED',
  API_AUTHENTICATION_FAILED: 'API_AUTHENTICATION_FAILED',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;
export type ExceptionType = (typeof ExceptionType)[keyof typeof ExceptionType];

export const ExceptionSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type ExceptionSeverity =
  (typeof ExceptionSeverity)[keyof typeof ExceptionSeverity];

export const ExceptionStatus = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  RETRYING: 'RETRYING',
  CLOSED: 'CLOSED',
} as const;
export type ExceptionStatus =
  (typeof ExceptionStatus)[keyof typeof ExceptionStatus];

// --- Human-readable labels ---------------------------------------------------

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  PENDING: 'Pending',
  READY: 'Ready to sync',
  SYNCING: 'Syncing',
  SYNCED: 'Synced',
  PARTIAL: 'Partially synced',
  EXCEPTION: 'Awaiting review',
  FAILED: 'Failed',
  RETRYING: 'Retrying',
  IGNORED: 'Ignored by rule',
};

export const EXCEPTION_TYPE_LABEL: Record<ExceptionType, string> = {
  MISSING_CONCERTO_REFERENCE: 'Missing Concerto reference',
  TARGET_JOB_NOT_FOUND: 'Target job not found',
  DUPLICATE_TARGET_MATCH: 'Duplicate target match',
  REQUIRED_FIELD_MISSING: 'Required field missing',
  INVALID_FIELD_VALUE: 'Invalid field value',
  DOCUMENT_UPLOAD_FAILED: 'Document upload failed',
  API_AUTHENTICATION_FAILED: 'API authentication failed',
  API_RATE_LIMIT: 'API rate limit reached',
  API_UNAVAILABLE: 'API temporarily unavailable',
  VALIDATION_ERROR: 'Validation error',
  UNKNOWN: 'Unknown error',
};

export const SYNC_RUN_STAGE_LABEL: Record<SyncRunStatus, string> = {
  QUEUED: 'Queued',
  VALIDATING: 'Validating Joblogic record',
  MATCHING: 'Matching Concerto job',
  TRANSFORMING: 'Transforming completion data',
  UPDATING: 'Updating Concerto',
  UPLOADING_DOCUMENTS: 'Uploading documents',
  VERIFYING: 'Verifying target record',
  SUCCESS: 'Complete',
  PARTIAL: 'Partially complete',
  FAILED: 'Failed',
  EXCEPTION: 'Exception raised',
};

/** Ordered stages a successful JOBLOGIC_TO_CONCERTO run passes through. */
export const SYNC_STAGE_SEQUENCE: SyncRunStatus[] = [
  SyncRunStatus.VALIDATING,
  SyncRunStatus.MATCHING,
  SyncRunStatus.TRANSFORMING,
  SyncRunStatus.UPDATING,
  SyncRunStatus.UPLOADING_DOCUMENTS,
  SyncRunStatus.VERIFYING,
  SyncRunStatus.SUCCESS,
];

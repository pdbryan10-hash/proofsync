import { Badge } from './badge';
import { SYNC_STATUS_LABEL } from '@/lib/domain/enums';
import type { PlannedChangeStatus } from '@/lib/sync/mapping-resolver';

type Tone = 'neutral' | 'navy' | 'success' | 'warning' | 'danger' | 'info';

const SYNC_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  READY: 'info',
  SYNCING: 'info',
  SYNCED: 'success',
  PARTIAL: 'warning',
  EXCEPTION: 'warning',
  FAILED: 'danger',
  RETRYING: 'info',
  IGNORED: 'neutral',
};

export function SyncStatusBadge({ status }: { status: string }) {
  const tone = SYNC_TONE[status] ?? 'neutral';
  const label = SYNC_STATUS_LABEL[status as keyof typeof SYNC_STATUS_LABEL] ?? status;
  return <Badge tone={tone} dot>{label}</Badge>;
}

const RUN_TONE: Record<string, Tone> = {
  SUCCESS: 'success',
  PARTIAL: 'warning',
  FAILED: 'danger',
  EXCEPTION: 'warning',
  QUEUED: 'neutral',
  VALIDATING: 'info',
  MATCHING: 'info',
  TRANSFORMING: 'info',
  UPDATING: 'info',
  UPLOADING_DOCUMENTS: 'info',
  VERIFYING: 'info',
};

export function RunStatusBadge({ status }: { status: string }) {
  const tone = RUN_TONE[status] ?? 'neutral';
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return <Badge tone={tone}>{label}</Badge>;
}

const SEVERITY_TONE: Record<string, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = SEVERITY_TONE[severity] ?? 'neutral';
  const label = severity.charAt(0) + severity.slice(1).toLowerCase();
  return <Badge tone={tone}>{label}</Badge>;
}

const EXCEPTION_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'danger',
  IN_REVIEW: 'warning',
  RETRYING: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

export function ExceptionStatusBadge({ status }: { status: string }) {
  const tone = EXCEPTION_STATUS_TONE[status] ?? 'neutral';
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return <Badge tone={tone} dot>{label}</Badge>;
}

const TRANSFER_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  TRANSFERRING: 'info',
  TRANSFERRED: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

export function TransferStatusBadge({ status }: { status: string }) {
  const tone = TRANSFER_TONE[status] ?? 'neutral';
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={tone}>{label}</Badge>;
}

const PLAN_TONE: Record<PlannedChangeStatus, Tone> = {
  WILL_UPDATE: 'info',
  ALREADY_MATCHES: 'neutral',
  EXCLUDED_BY_RULE: 'neutral',
  NEEDS_REVIEW: 'warning',
};
const PLAN_LABEL: Record<PlannedChangeStatus, string> = {
  WILL_UPDATE: 'Will update',
  ALREADY_MATCHES: 'Already matches',
  EXCLUDED_BY_RULE: 'Excluded by rule',
  NEEDS_REVIEW: 'Needs review',
};

export function PlannedChangeBadge({ status }: { status: PlannedChangeStatus }) {
  return <Badge tone={PLAN_TONE[status]}>{PLAN_LABEL[status]}</Badge>;
}

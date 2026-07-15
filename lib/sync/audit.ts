import { prisma } from '@/lib/db/prisma';
import type { EventLevel, SyncRunStatus } from '@/lib/domain/enums';

/**
 * Append-only audit logger. Every meaningful step of a sync writes a SyncEvent,
 * producing the human-readable timeline shown on the Sync History tab and the
 * technical record required for §21 auditability.
 */
export class SyncAuditLog {
  constructor(private readonly syncRunId: string) {}

  async record(
    stage: SyncRunStatus,
    level: EventLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.syncEvent.create({
      data: {
        syncRunId: this.syncRunId,
        stage,
        level,
        message,
        metadata: metadata ? JSON.stringify(redactSecrets(metadata)) : null,
      },
    });
  }
}

/**
 * Defensive redaction so audit metadata never persists credentials, even if a
 * provider response echoes one back. Logging without secrets (§18).
 */
const SECRET_KEYS = /(secret|password|token|apikey|api_key|authorization|clientsecret)/i;
export function redactSecrets(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.test(k)) out[k] = '[redacted]';
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSecrets(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

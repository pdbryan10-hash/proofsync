import type { TriggerType } from '@/lib/domain/enums';

export interface SyncDispatchRequest {
  jobId: string;
  triggerType: TriggerType;
  idempotencyKey?: string | null;
  sourceEventId?: string | null;
  eventType?: string;
  completionVersion?: string | null;
}

export interface SyncDispatchResult {
  syncRunId: string | null;
  status: string;
  skipped: boolean;
  message: string;
}

/**
 * SyncJobDispatcher abstraction (§9).
 *
 * Decouples "a sync should happen" from "how it is executed". The MVP runs the
 * work inline (InlineSyncDispatcher) which is safe for mock-mode demos and low
 * volume. A production deployment swaps in a queue-backed implementation
 * (Vercel background function, SQS/Upstash, or a managed workflow engine)
 * WITHOUT touching callers.
 */
export interface SyncJobDispatcher {
  dispatch(request: SyncDispatchRequest): Promise<SyncDispatchResult>;
}

/**
 * Inline dispatcher: executes the sync in-process. Imports the service lazily to
 * avoid a circular import at module-eval time.
 */
export class InlineSyncDispatcher implements SyncJobDispatcher {
  async dispatch(request: SyncDispatchRequest): Promise<SyncDispatchResult> {
    const { JobCompletionSyncService } = await import('./job-completion-sync-service');
    const service = new JobCompletionSyncService();
    return service.run(request);
  }
}

/**
 * Production placeholder. A real implementation enqueues the request and returns
 * immediately so the webhook responds fast (§9). Left as a documented scaffold.
 */
export class QueuedSyncDispatcher implements SyncJobDispatcher {
  async dispatch(request: SyncDispatchRequest): Promise<SyncDispatchResult> {
    void request;
    // TODO(production): push `request` onto the queue (e.g. Upstash QStash,
    //   Vercel background function, or a managed workflow) and return a queued
    //   acknowledgement. A worker then calls JobCompletionSyncService.run().
    throw new Error('QueuedSyncDispatcher is a production scaffold and is not enabled in the MVP.');
  }
}

export function getSyncDispatcher(): SyncJobDispatcher {
  // The MVP uses inline execution; swap here to promote to a queue.
  return new InlineSyncDispatcher();
}

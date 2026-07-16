# Architecture

ProofSync is a Next.js (App Router) application with a clean separation between
**presentation** (server/client components), **application services**, a
**deterministic sync engine**, and **provider connectors**. Provider-specific logic
is confined to `lib/integrations/`; nothing above that layer knows how Joblogic or
Concerto format their requests.

## 1. System architecture

```mermaid
flowchart TB
  subgraph Sources
    JL["Joblogic (source of truth)\nengineer completes job"]
  end
  subgraph PROOFSYNC["ProofSync"]
    direction TB
    WH["/api/webhooks/joblogic\n(real-time)"]
    CRON["/api/cron/poll-completions\n(every 30 min · safety net)"]
    DISP["SyncJobDispatcher\n(inline now · queue-ready)"]
    ENGINE["JobCompletionSyncService\nvalidate→match→transform→update→upload→verify"]
    subgraph Connectors["lib/integrations"]
      JLC["JoblogicConnector\nMock | Live"]
      CC["ConcertoConnector\nMock | Live"]
    end
    DB[("MongoDB (Atlas)\nvia Prisma")]
    UI["App Router UI\nDashboard · Jobs · Exceptions · Integrations · Settings"]
  end
  subgraph Targets
    CON["Concerto (target CAFM)\noriginal job updated"]
  end

  JL -- "completion event" --> WH
  JL -. "polled" .-> CRON
  WH --> DISP
  CRON --> DISP
  DISP --> ENGINE
  ENGINE --> JLC
  ENGINE --> CC
  JLC <--> JL
  CC <--> CON
  ENGINE <--> DB
  UI <--> DB
```

Mock mode short-circuits the connectors to the application database (the `Job` /
`JobCompletion` / `Document` tables stand in for Joblogic; the `MockConcertoJob`
table *is* the Concerto target), so the entire flow runs with no external services.

## 2. Sync sequence (JOBLOGIC → CONCERTO)

```mermaid
sequenceDiagram
  autonumber
  participant T as Trigger (webhook / poll / manual)
  participant D as Dispatcher
  participant S as JobCompletionSyncService
  participant JL as JoblogicConnector
  participant C as ConcertoConnector
  participant DB as DB (SyncRun · SyncEvent)

  T->>D: dispatch(jobId, trigger, idempotencyKey)
  D->>S: run()
  S->>DB: create SyncRun (QUEUED) + idempotency guard
  S->>S: VALIDATE (complete? reference present & valid?)
  alt no / invalid reference
    S->>DB: Exception (MISSING_CONCERTO_REFERENCE) · stop
  end
  S->>C: MATCH findJobByReference(ref)
  alt 0 matches
    S->>DB: Exception (TARGET_JOB_NOT_FOUND) · stop
  else >1 matches
    S->>DB: Exception (DUPLICATE_TARGET_MATCH) · stop
  end
  S->>S: TRANSFORM (apply mappings + client policy)
  S->>C: UPDATE updateJob(ref, payload)
  S->>JL: download documents
  S->>C: UPLOAD permitted documents
  S->>C: VERIFY verifyUpdate(ref, expected)
  S->>DB: SyncRun SUCCESS/PARTIAL + audit events
  S->>DB: mark job SYNCED/PARTIAL · markProcessed()
```

## 3. Exception flow

```mermaid
flowchart TD
  A["Sync attempt"] --> B{Error?}
  B -- No --> S["SUCCESS / PARTIAL"]
  B -- Yes --> C{isRetryableError?}
  C -- "No\n(missing ref, duplicate,\ninvalid data, auth)" --> E1["Exception OPEN\njob = EXCEPTION"]
  C -- "Yes\n(timeout, 429, 502/503)" --> E2["job = FAILED\nretry-eligible"]
  E1 --> R["Operator: Exceptions screen"]
  E2 --> R
  R --> F{Action}
  F -- "Fix reference + retry" --> A
  F -- "Retry" --> A
  F -- "Mark resolved" --> G["RESOLVED\n+ audit record"]
  A -. "on retry success" .-> H["Exception → RESOLVED\njob → SYNCED"]
```

## Data model (Prisma)

`Organisation → Client → Job → { JobCompletion, Document, SyncRun → SyncEvent,
Exception }`, plus `IntegrationConnection`, `FieldMapping`, `ProcessedEvent`
(idempotency ledger) and `MockConcertoJob` (the demo target system). See
[`prisma/schema.prisma`](../prisma/schema.prisma).

## Key modules

| Concern | Location |
| --- | --- |
| Connector interfaces | `lib/integrations/types.ts` |
| Mock / live connectors | `lib/integrations/{joblogic,concerto}/` |
| Sync engine | `lib/sync/job-completion-sync-service.ts` |
| Field transforms | `lib/sync/field-transformer.ts` |
| Mapping + policy resolution | `lib/sync/mapping-resolver.ts` |
| Idempotency | `lib/sync/idempotency.ts` |
| Dispatcher abstraction | `lib/sync/dispatcher.ts` |
| Retry policy | `lib/sync/retry-policy.ts` |
| Typed errors | `lib/errors/integration-errors.ts` |
| Polling ingestion | `lib/services/poller.ts` |

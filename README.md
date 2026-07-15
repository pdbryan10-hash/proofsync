# SEE CAFM Sync

**Automated Joblogic → Concerto job completion integration.**
Powered by ProofWorks, for SEE Services.

> **Complete once. Sync automatically. Review only the exceptions.**

SEE engineers already complete their work and record the result in Joblogic. SEE
should not then pay an administrator to manually re-key that same result into the
client's Concerto CAFM platform. SEE CAFM Sync makes a **Joblogic completion the
trigger for an automated, controlled, auditable update of the matching Concerto
job** — using the unique Concerto job reference stored against the Joblogic job as
the cross-system matching key.

This is deterministic operational automation. There is no chatbot and no generative
AI — the value is speed, control, auditability, exception management and measurable
time saved.

---

## What it does

```
CONCERTO  → client raises job (unique Concerto reference)
JOBLOGIC  → SEE manages & the engineer completes the job
SEE CAFM SYNC → Validate → Match → Transform → Update → Upload → Verify
CONCERTO  → the original job is automatically updated
          → SUCCESS · PARTIAL · or a first-class EXCEPTION (never a silent failure)
```

Every attempted sync ends in exactly one outcome: **Synced · Partially synced ·
Awaiting review · Failed · Retrying · Ignored by rule.**

---

## Key features

- **Typed connector architecture** — `JoblogicConnector` / `ConcertoConnector`
  interfaces with `Mock*` (demo) and `Live*` (production scaffold) implementations.
  Switch with `INTEGRATION_MODE=mock|live`. No provider-specific logic leaks out of
  `lib/integrations/`.
- **Explicit sync engine** (`JobCompletionSyncService`) — validate → match →
  transform → update → upload → verify, with a full audit event per step.
- **Never updates the wrong job** — a unique, format-valid Concerto reference is
  mandatory. No reference, no target, or multiple targets each raise a distinct
  exception rather than guessing.
- **Real data changes in mock mode** — the mock Concerto system is a database table
  the engine genuinely writes to, so "inspect target before → sync → inspect after"
  shows actual changed values.
- **Idempotent ingestion** — webhook and polling triggers are de-duplicated by
  source event id / job id / completion version, so the same completion can never
  update Concerto twice.
- **Webhook + 30-minute polling** — real-time `POST /api/webhooks/joblogic` plus a
  scheduled safety-net poller (`/api/cron/poll-completions`, Vercel Cron `*/30`).
- **Exception management** — a first-class operational screen: supply a missing
  reference and retry, resolve, or review. Retryable vs non-retryable is a typed
  decision.
- **Configurable field mapping & client policy** — transparent transforms
  (DIRECT, MINUTES_TO_HOURS, CURRENCY_FORMAT, BOOLEAN_TO_TEXT, STATUS_MAP, …) and
  per-client rules (sync costs? require approval before close?).

---

## Tech stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma ORM ·
SQLite (local) / PostgreSQL (production) · Zod · React Hook Form · Vitest ·
Playwright · Vercel-ready.

---

## Local installation

Requires Node 20+ (developed on Node 24). No database server needed locally — the
demo runs on SQLite.

```bash
npm install                # installs deps and generates the Prisma client
cp .env.example .env       # defaults are fine for the demo
npm run db:push            # create the SQLite schema (dev.db)
npm run db:seed            # seed ~20 realistic SEE jobs + history
npm run dev                # http://localhost:3000
```

To reset the demo to a pristine state at any time:

```bash
npm run db:reset           # force-resets the schema and re-seeds
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit + integration tests |
| `npm run test:e2e` | Playwright end-to-end (needs a seeded DB) |
| `npm run db:push` / `db:seed` / `db:reset` | Database lifecycle |

---

## Environment variables

See [`.env.example`](.env.example). Never put secrets in `NEXT_PUBLIC_*`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file locally; Postgres URL in production |
| `INTEGRATION_MODE` | `mock` (demo) or `live` |
| `JOBLOGIC_API_BASE_URL` / `_API_KEY` / `_TENANT_ID` / `_WEBHOOK_SECRET` | Live Joblogic access (server-only) |
| `CONCERTO_API_BASE_URL` / `_API_KEY` / `_CLIENT_ID` / `_CLIENT_SECRET` | Live Concerto access (server-only) |
| `CRON_SECRET` | Protects the completion-polling cron |
| `ESTIMATED_MANUAL_MINUTES_PER_JOB` | Admin-time-saved estimate (default 15) |
| `NEXT_PUBLIC_APP_NAME` | Display name |

---

## Demo mode vs live mode

- **Mock mode** (default) uses `MockJoblogicConnector` / `MockConcertoConnector`
  backed by the local database, so the whole flow works with no external
  credentials. The mock Concerto target is a real table the engine writes to.
- **Live mode** (`INTEGRATION_MODE=live`) uses `LiveJoblogicConnector` /
  `LiveConcertoConnector`. These are **scaffolds**: every real endpoint is marked
  with a `TODO(joblogic)` / `TODO(concerto)` comment. **No endpoints are invented.**
  Complete the [integration checklist](docs/integration-checklist.md) first.

---

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Provision **Vercel Postgres** (or Neon) and set `DATABASE_URL`.
3. In [`prisma/schema.prisma`](prisma/schema.prisma) change the datasource
   `provider` from `sqlite` to `postgresql`. The models are already
   Postgres-portable (string-backed enums, no SQLite-only features) — no other
   changes are required.
4. Set the environment variables above in the Vercel project (start with
   `INTEGRATION_MODE=mock` to demo in the cloud; set `CRON_SECRET`).
5. Deploy. Run the migration + seed once:
   `npx prisma migrate deploy` (or `prisma db push`) then `npm run db:seed`.
6. The 30-minute completion poller in [`vercel.json`](vercel.json) is picked up
   automatically as a Vercel Cron.

No local filesystem is used for persistent state and there are no hardcoded
localhost URLs.

---

## The two headline demo workflows

**1 · Automated completion sync**
Dashboard → Jobs → open **CON-284731** (Riverside House, Nottingham) → review the
Joblogic source vs the blank Concerto target and the field mapping → **Sync to
Concerto** → watch the 7 stages → 6 fields updated + 1 certificate transferred +
verified → open **Sync History** for the audit trail → return to the dashboard.

**2 · Exception resolve & retry**
Exceptions → **JL-48411** (missing Concerto reference) → **Fix & retry** → enter
`CON-284811` → Save & retry → the sync runs, succeeds, and the exception closes to
Resolved with a full audit record.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system, sync-sequence and
  exception-flow diagrams (Mermaid).
- [`docs/integration-checklist.md`](docs/integration-checklist.md) — everything
  required from SEE and the client before a live integration.
- [`docs/production-readiness.md`](docs/production-readiness.md) — what is
  production-grade today and what to harden before go-live.

---

## Known assumptions

- The Concerto reference demo format is `CON-` + 4–8 digits
  ([`lib/domain/validation.ts`](lib/domain/validation.ts)); confirm the real format
  in the mapping workshop.
- Target Concerto field names (`contractorCompletionNotes`, `actualLabourDuration`,
  …) are representative and centralised in
  [`lib/domain/field-labels.ts`](lib/domain/field-labels.ts) and the seeded mappings.
- The MVP dispatcher runs syncs inline; a `QueuedSyncDispatcher` scaffold marks
  where a production queue slots in without changing callers.
- Admin-time saved is a clearly-labelled **estimate**, not an independently verified
  figure.

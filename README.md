# ProofSync

**Verified job-completion sync between a contractor's job-management system and the client's CAFM.**
A ProofWorks product. Launch customer: **SEE Services** (Joblogic → Concerto).

> **Complete once. Sync automatically. Review only the exceptions.**

---

## The problem

Every FM contractor works into their client's CAFM. The client raises the job there;
the contractor manages and completes it in their own system. So the completion data —
notes, attendance, time on site, costs, certificates — ends up in the *contractor's*
system, while the *client* only ever looks at theirs.

The industry's answer is a human: an administrator opens both systems and re-types the
same result twice. **10–20 minutes per completed job, every job, forever.**

ProofSync removes that step. An engineer completes the job once. ProofSync finds the
matching job in the client's CAFM using its unique reference, maps the fields,
transfers the certificates, **verifies the write**, and records a full audit trail.
A human only intervenes when something genuinely needs judgement.

This is deterministic operational automation — no chatbot, no generative AI. The value
is speed, control, auditability, exception management and measurable time saved.

---

## Why it generalises

The sync engine has **no knowledge of any specific vendor**. It speaks normalised
shapes; every provider quirk is sealed inside a connector implementing a common
interface:

```
lib/integrations/
  types.ts          ← JoblogicConnector / ConcertoConnector interfaces
  joblogic/         ← Mock + Live   (source: contractor's system)
  concerto/         ← Mock + Live   (target: client's CAFM)
```

A new system pairing is **a new connector file, not a new product**:

| Contractor side (source) | Client side (target CAFM) |
| --- | --- |
| Joblogic ✅, Simpro, BigChange, Field Service Lightning… | Concerto ✅, Planon, Concept Evolution, QFM, Maximo… |

Same engine, same mapping layer, same exceptions queue, same audit trail.

---

## What it does

```
CLIENT CAFM  → client raises job (unique job reference)
CONTRACTOR   → contractor manages & the engineer completes the job
PROOFSYNC    → Validate → Match → Transform → Update → Upload → Verify
CLIENT CAFM  → the original job is automatically updated
             → SUCCESS · PARTIAL · or a first-class EXCEPTION (never a silent failure)
```

Every attempted sync ends in exactly one outcome: **Synced · Partially synced ·
Awaiting review · Failed · Retrying · Ignored by rule.**

---

## Key features

- **Typed connector architecture** — `Mock*` (demo) and `Live*` (production scaffold)
  implementations behind one interface. Switch with `INTEGRATION_MODE=mock|live`.
  No provider-specific logic leaks out of `lib/integrations/`.
- **Explicit sync engine** (`JobCompletionSyncService`) — validate → match →
  transform → update → upload → verify, with a full audit event per step.
- **Never updates the wrong job** — a unique, format-valid reference is mandatory.
  No reference, no target, or multiple targets each raise a distinct exception rather
  than guessing. **No reference = no automated update.**
- **Verified writes** — the target record is re-read and compared after every update.
  This is the "Proof" in ProofSync.
- **Real data changes in mock mode** — the mock target is a real collection the engine
  writes to, so "inspect target before → sync → inspect after" shows actual changes.
- **Idempotent ingestion** — webhook and polling triggers are de-duplicated by source
  event id / job id / completion version, so the same completion can never update the
  target twice.
- **Webhook + 30-minute polling** — real-time `POST /api/webhooks/joblogic` plus a
  scheduled safety-net poller (`/api/cron/poll-completions`, Vercel Cron `*/30`).
- **Exception management** — a first-class operational screen: supply a missing
  reference and retry, resolve, or review. Retryable vs non-retryable is a typed
  decision.
- **Configurable field mapping & per-client policy** — transparent transforms
  (DIRECT, MINUTES_TO_HOURS, CURRENCY_FORMAT, BOOLEAN_TO_TEXT, STATUS_MAP, …) and
  rules like *sync costs?* / *require approval before close?*

---

## Tech stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Prisma ORM ·
**MongoDB (Atlas)** · Zod · React Hook Form · Vitest · Playwright · Vercel.

---

## Local installation

Requires Node 20+ (developed on Node 24) and a MongoDB connection string.

```bash
npm install                # installs deps and generates the Prisma client
cp .env.example .env       # set DATABASE_URL to your MongoDB connection string
npm run db:push            # create collections + indexes
npm run db:seed            # seed ~20 realistic FM jobs + history
npm run dev                # http://localhost:3000
```

To reset the demo to a pristine state at any time:

```bash
npm run db:reset           # re-pushes and re-seeds
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
| `DATABASE_URL` | MongoDB connection string (Atlas) |
| `INTEGRATION_MODE` | `mock` (demo) or `live` |
| `JOBLOGIC_API_BASE_URL` / `_API_KEY` / `_TENANT_ID` / `_WEBHOOK_SECRET` | Live source access (server-only) |
| `CONCERTO_API_BASE_URL` / `_API_KEY` / `_CLIENT_ID` / `_CLIENT_SECRET` | Live target access (server-only) |
| `CRON_SECRET` | Protects the completion-polling cron |
| `ESTIMATED_MANUAL_MINUTES_PER_JOB` | Admin-time-saved estimate (default 15) |
| `NEXT_PUBLIC_APP_NAME` | Display name (`ProofSync`) |

---

## Demo mode vs live mode

- **Mock mode** (default) uses `MockJoblogicConnector` / `MockConcertoConnector`
  backed by the database, so the whole flow works with no external credentials.
- **Live mode** (`INTEGRATION_MODE=live`) uses the `Live*` connectors. These are
  **scaffolds**: every real endpoint is marked with a `TODO(joblogic)` /
  `TODO(concerto)` comment. **No endpoints are invented.** Complete the
  [integration checklist](docs/integration-checklist.md) first.

---

## Deploying to Vercel

1. Set `DATABASE_URL` to your MongoDB Atlas connection string, plus the env vars above
   (`INTEGRATION_MODE=mock` to demo in the cloud; set `CRON_SECRET`).
2. Deploy (`vercel --prod`). Ensure Atlas network access permits Vercel.
3. Seed once: `npm run db:push && npm run db:seed` against the same `DATABASE_URL`.
4. The 30-minute completion poller in [`vercel.json`](vercel.json) registers
   automatically as a Vercel Cron.

No local filesystem is used for persistent state and there are no hardcoded
localhost URLs.

---

## The two headline demo workflows

**1 · Automated completion sync**
Dashboard → Jobs → open **CON-284731** (Riverside House, Nottingham) → review the
source data vs the blank target and the field mapping → **Sync to Concerto** → watch
the 7 stages → 6 fields updated + 1 certificate transferred + verified → open **Sync
History** for the audit trail → return to the dashboard.

**2 · Exception resolve & retry**
Exceptions → **JL-48411** (missing reference) → **Fix & retry** → enter `CON-284811`
→ Save & retry → the sync runs, succeeds, and the exception closes to Resolved with a
full audit record.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system, sync-sequence and
  exception-flow diagrams (Mermaid).
- [`docs/integration-checklist.md`](docs/integration-checklist.md) — everything
  required from the contractor and the client before a live integration.
- [`docs/production-readiness.md`](docs/production-readiness.md) — what is
  production-grade today and what to harden before go-live.

---

## Known assumptions

- The reference demo format is `CON-` + 4–8 digits
  ([`lib/domain/validation.ts`](lib/domain/validation.ts)); confirm the real format
  per client in the mapping workshop.
- Target field names (`contractorCompletionNotes`, `actualLabourDuration`, …) are
  representative, centralised in [`lib/domain/field-labels.ts`](lib/domain/field-labels.ts)
  and the seeded mappings.
- The MVP dispatcher runs syncs inline; a `QueuedSyncDispatcher` scaffold marks where
  a production queue slots in without changing callers.
- Admin-time saved is a clearly-labelled **estimate**, not an independently verified
  figure.

---

## Branding note

**ProofSync** is the product and the only brand in the UI chrome. **SEE Services** is
the named launch customer and appears as attribution only — never as the product's own
identity. See [`components/brand/`](components/brand/).

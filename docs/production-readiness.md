# Production Readiness

What is production-grade in this build, and what to harden before a live go-live.

## Already production-shaped

- **Isolated connector architecture** — swapping mock → live is a config flag; no
  provider logic leaks into the app or UI.
- **Deterministic, auditable sync engine** — explicit stages, an append-only
  `SyncEvent` timeline, and a terminal outcome for every attempt (no silent fail).
- **Safe matching** — a unique, format-valid Concerto reference is mandatory; zero,
  missing, or duplicate targets each raise a distinct, typed exception.
- **Idempotency** — `ProcessedEvent` ledger keyed by event id / job id / completion
  version; webhook and poll paths both guard against double-updates.
- **Typed error model + retry policy** — `isRetryableError` separates transient
  (timeout/429/502/503) from structural failures; capped exponential backoff.
- **Security basics** — secrets only in server env; Zod validation at every
  boundary; webhook signature abstraction; audit metadata redaction; safe API error
  messages; mutating routes funnel through a role gate; API timeouts on live calls;
  document type/size validation.
- **Single persistence layer** — Prisma on MongoDB (Atlas), matching the wider ProofWorks
  stack; one provider across local and production.
- **Scheduled safety net** — 30-minute completion poller via Vercel Cron, protected
  by `CRON_SECRET`.

## Harden before go-live

| Area | Now (MVP) | Production |
| --- | --- | --- |
| **Auth** | Role scaffold in `lib/auth.ts` (permissive demo) | Wire real SSO/Clerk/NextAuth; resolve session → role; protect all pages |
| **Async processing** | `InlineSyncDispatcher` runs syncs in-request | Swap to `QueuedSyncDispatcher` (Upstash QStash / Vercel background / workflow engine) so webhooks return immediately and bulk syncs scale |
| **Webhook signing** | HMAC-SHA256 abstraction; unenforced if secret unset | Set `JOBLOGIC_WEBHOOK_SECRET`; confirm Joblogic's real scheme/header |
| **Secrets** | Env vars | Managed secret store (Vercel/Doppler/Vault); rotation |
| **Rate limiting** | None on public webhook | Add IP/tenant rate limiting on `/api/webhooks/*` and `/api/cron/*` |
| **Automatic retries** | Manual retry + retry policy present | Enqueue retryable failures on the backoff schedule via the queue |
| **Observability** | `console` + audit trail | Structured logging + Sentry/OTel; alert on exception spikes |
| **Multi-tenant** | Single org/client seeded | Enforce org scoping on every query; per-tenant credentials |
| **Schema changes** | `prisma db push` | MongoDB has no migration history — version schema changes deliberately; review index changes before applying |
| **Referential integrity** | Explicit ordered deletes (Mongo has no cascade) | Keep deletes centralised; add orphan-sweep job |
| **New system pairings** | Joblogic → Concerto | Add a connector per system (Simpro/BigChange · Planon/QFM/Maximo); engine unchanged |
| **Live connectors** | `TODO`-marked scaffolds | Implement against confirmed endpoints (see integration checklist) |
| **Backups/retention** | — | DB backups; audit-retention policy per client |

## Pre-launch verification

- [ ] `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- [ ] One job synced end-to-end in the Concerto **test** environment.
- [ ] Webhook signature verification enforced (secret set).
- [ ] `CRON_SECRET` set; cron visible in the Vercel dashboard.
- [ ] Exception ownership assigned; alerting configured.
- [ ] Field mappings and client policy confirmed with SEE + client.

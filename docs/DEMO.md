# The live sync demo (`/demo`)

A running proof that completed jobs move out of a contractor's job-management
system and into a client's CAFM, on a 30-second beat, with a human only ever
seeing the exceptions.

## What it proves — and what it doesn't

**Proves.** Two genuinely separate databases stand in for the two systems, each
reached through its own connector, its own driver and its own connection pool.
Everything between them is ProofSync's production code: the same change
detection, field mapping, client sync policy, idempotency ledger, verification
read-back, retry policy, exception handling and audit trail a live deployment
runs. The records moving across the console are real records being written into
a database ProofSync does not otherwise touch.

**Does not prove.** The connectors reach those databases directly. The sign-in
shown on the console is a modelled session — authenticate, hold a token, let it
expire, re-authenticate — not a browser driving a real Joblogic or Concerto
login. Where a vendor exposes no API, that access method is the remaining piece
of work.

This distinction is load-bearing. Do not let the demo be described as proving
login-based access to a real system. It proves the pipeline, not the door.

> **Conflict to resolve before this goes in front of anyone.** The sales pages
> currently promise *"Managed secret store. Never in the database, never in a
> browser."* If the pitch becomes "we log in as a user where there's no API",
> that is a browser. Both stories cannot be told at once.

## Running it

```bash
# .env
DATABASE_URL="mongodb+srv://…/see_cafm_sync"
INTEGRATION_MODE=demo
DEMO_MODE=1
```

```bash
npm run dev
# POST http://localhost:3000/api/demo/reset   → seed both systems
# open http://localhost:3000/demo
```

`DEMO_MODE=0` (or unset) makes `/demo` and every `/api/demo/*` route 404. The
demo routes also refuse to run while `INTEGRATION_MODE=live`, so fabricated jobs
can never be driven into a real client's CAFM by misconfiguration.

## The three stores

| Store | Database | Accessed via | Holds |
|---|---|---|---|
| Source system ("Joblogic") | `proofsync_demo_joblogic` | raw Mongo driver | jobs, completion sheets, attachments, its own users |
| Target system ("Concerto") | `proofsync_demo_concerto` | raw Mongo driver | work orders, attribute bag, documents, its own users |
| ProofSync | `see_cafm_sync` | Prisma | job mirror, sync runs, events, exceptions, idempotency ledger |

By default all three are separate databases on the same Atlas cluster, so the
demo needs no extra infrastructure. `DEMO_JOBLOGIC_DB_URL` /
`DEMO_CONCERTO_DB_URL` move either system to a wholly separate cluster.

The two stand-in systems are deliberately **not** on Prisma. A foreign system
does not share ProofSync's ORM, its schema or its client — reaching them through
their own driver is what makes "two separate systems" structurally true rather
than a naming convention over one database. Their document shapes use a foreign
vendor's vocabulary (Joblogic nests a `visit` and an `engineer`; Concerto keeps a
flat `attributes` bag and calls the person an `operative`), so the transform
stage is real work rather than a field copy.

## Why the beat isn't a cron

**Vercel Cron cannot go below one minute**, and Hobby only allows daily
schedules. So a 30-second beat cannot come from `vercel.json`.

Instead, callers ping `/api/demo/tick` more often than the interval, and the
*server* claims each beat atomically (a single conditional `findOneAndUpdate` on
a control document — Mongo guarantees single-document atomicity). Early callers
are told how long is left and nothing happens. So:

- The open console pings every 5s → the beat fires the moment it's due.
- Two people watching does not produce two beats.
- A browser refresh does not skip one.
- `/api/cron/demo-tick` runs every minute as a **headless backstop**, so someone
  opening the link cold sees a system that has been running rather than one
  frozen where the last viewer left it.

The cadence is a property of the system, not of who has a tab open.

## Seeded faults

A demo where everything succeeds proves nothing about what happens when it
doesn't — and the exception paths are the part a client actually cares about.
The source data carries its own faults; the engine is never told and has to find
out. Rates are in `lib/demo/seeder.ts`:

| Fault | Rate | Exercises |
|---|---|---|
| Engineer left the client's order reference blank | 10% | `MISSING_CONCERTO_REFERENCE` |
| Reference typed in a format Concerto never issues | 6% | reference-format validation |
| Reference valid but no such work order exists | 5% | `TARGET_JOB_NOT_FOUND` |
| Concerto rejects the first write with a 503 | 8% | retry policy |
| One attachment rejected on upload | 7% | `PARTIAL` outcome |

The demo client's policy has **costs off**, so a successful sync writes seven
fields and visibly withholds `contractorCost` by rule rather than quietly
dropping it.

## The swap point

`lib/demo/session.ts` is the seam. Replacing it with a Playwright-backed driver
that genuinely fills the login form and reads the DOM changes **nothing** above
it — the connectors, the engine, the ledger and the console are all unaware of
the transport. That is the whole reason the demo is built behind the real
`JoblogicConnector` / `ConcertoConnector` interfaces rather than as a mock.

## Beat budget

A sync takes ~4.5s (seven deliberately paced stages — `STAGE_DELAY_MS`, applied
only when the far side is a stand-in, never against live APIs). The tick route's
`maxDuration` is 60s, so `ingestAndSync` caps at **8 dispatches per beat**.
Overflow stays `PENDING` for the next beat and is reported as `deferred` — work
is deferred, never dropped.

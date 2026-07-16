# The live sync demo (`/demo`)

A running proof that completed jobs move out of a contractor's job-management
system and into a client's CAFM, on a 30-second beat, with a human only ever
seeing the exceptions.

## Two transports

`DEMO_TRANSPORT` decides how the connectors reach the two stand-in systems. Both
run the identical engine; they prove very different things.

### `direct` (default — runs anywhere, including Vercel)

Reads and writes the two systems' databases. The login lifecycle is modelled in
`lib/demo/session.ts` — authenticate, hold a token, let it expire,
re-authenticate — but the transport underneath is a database call.

**Proves** the pipeline: change detection, field mapping across two different
vocabularies, client sync policy, idempotency, verification, retry, exception
handling, audit. **Does not prove** the access method. Do not describe it as
proving login-based access to anything.

### `browser` (local only — the real proof)

Drives a real Chromium through both systems' actual screens: fills the login
form, reads the completed job off the rendered page, opens the client's work
order, types into the form field by field, clicks Save, and reloads to verify
what actually stuck. **No API call anywhere.** Screenshots are captured at each
step and stored against the sync run, so the evidence survives the demo.

Measured: ~30s per beat for 2 syncs (~5–10s each) on a laptop.

**Cannot run on Vercel.** There is no Chromium binary in the serverless runtime
and the function size limits fight you. `playwright` is a devDependency,
dynamically imported, and listed in `serverExternalPackages` — a production build
never resolves it. This is a local or containerised-worker capability. Keep the
Vercel deployment on `direct`.

```bash
npx playwright install chromium   # once
# .env
DEMO_TRANSPORT=browser
DEMO_BASE_URL=http://localhost:3000
# DEMO_HEADLESS=1   # hide the window; screenshots still captured
```

**What `browser` still does not prove.** The two systems are stand-ins we built,
so their screens behave. It does not prove the real Joblogic or Concerto can be
driven this way, nor that doing so is permitted by their terms, survives MFA, or
withstands a UI redesign. Document upload is the one step not done through the
screen (the stand-in has no upload control) — a real screen-driven upload means
`setInputFiles` and waiting out a progress bar.

> **Conflict to resolve before this goes in front of anyone.** The sales pages
> currently promise *"Managed secret store. Never in the database, never in a
> browser."* The browser transport is, unavoidably, a browser. Both stories
> cannot be told at once.

## The stand-in systems' own UIs

`/systems/joblogic/*` and `/systems/concerto/*` are the two systems' web
interfaces — real login forms, real cookie sessions (`lib/systems/auth.ts`), real
data from their own databases, a real save. They are what the browser transport
drives, and you can open them yourself from the console's panel headers.

They are labelled Joblogic and Concerto and look like plausible FM software, but
they are deliberately **not** imitations of either vendor's real product. Naming
the systems you integrate with is ordinary; shipping a copy of someone's UI is
not.

Nothing is rigged for the automation. Values are located by their visible label
text — no test ids, no data attributes. That fragility is the honest part: a
label change breaks the scrape, which is exactly why the ladder below puts DOM
automation last.

**The access ladder**, in order of preference: API → SFTP/CSV/email import →
portal bulk upload → internal JSON endpoints → DOM automation. The browser
transport is the bottom rung, and it is where you end up only when a vendor
leaves you nowhere else.

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

The tick route's `maxDuration` is 60s, so `ingestAndSync` caps the syncs it will
attempt per beat (`getMaxDispatchesPerTick`): **8** on `direct` (~4.5s each),
**2** on `browser` (~5–10s each). Overflow stays `PENDING` for the next beat and
is reported as `deferred` — work is deferred, never dropped.

`STAGE_DELAY_MS` pads each of the seven stages by 450ms so a sync is legible to
someone watching. It applies only to transports with no real latency of their
own — never to live APIs, and never to `browser`, which is already visibly slow
because a browser is genuinely doing the work.

## Notes for anyone extending this

- **The N+1 is real.** The engine asks three separate questions about each job
  (details, completion, documents). A naive browser connector navigates for every
  one; that cost 56s a beat before `signedInPage` learned not to re-fetch a page
  it is already on. Screen-scraping has no join.
- **Cache contexts by owner, not by liveness.** `BrowserContext.pages()` returns
  `[]` on a closed context rather than throwing, so a try/catch "liveness probe"
  silently hands back a dead context and fails later at `newPage()`. Compare
  `context.browser() === browser` instead.
- **Kill stray dev servers.** Next silently moves to the next free port when 3000
  is taken, so a forgotten server will keep answering with stale code while your
  new one runs somewhere else entirely.

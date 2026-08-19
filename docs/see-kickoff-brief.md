# ProofSync kick-off — what we need out of the session

**SEE · Concerto ⇄ Joblogic · ~90 minutes**

The loop we are automating, in the order it happens:

1. **The client raises a job in Concerto.** SEE has to notice it.
2. **SEE raises the same job in Joblogic** so it can be planned and worked — and the
   Concerto reference is written onto it here. *This is where the matching key is born.*
3. The engineer does the work and **completes it in Joblogic**.
4. **The completion goes back into Concerto** — fields, and the certificates and job
   sheets that have to land with it.

Legs 1–2 and leg 4 are both re-keying, and both are in scope. The same job is typed in
twice today.

Both systems will be worked the way your coordinator works them — signed in as a
licensed user of yours, through the screens, the method already proven on VX Maintain.
So what we can build is decided by what is actually on those screens, and none of it is
written down anywhere.

> **Build note (internal).** The engine today is one-directional:
> `JOBLOGIC_TO_CONCERTO`, completion outbound. **Intake — Concerto → Joblogic — is a new
> direction**, not a config change: a Concerto *source* read and a Joblogic *write* path.
> Establish on this call whether phase one is the whole loop or completion-back first.
> See `docs/architecture.md` and the connector interfaces in `lib/integrations/types.ts`.

---

## The two recordings we want

Not a discussion — two screen recordings, made on the call, with the forms captured:

- **One job coming in**: from however it appears in Concerto, through to a raised Joblogic job.
- **One job going back**: a completed Joblogic job re-keyed into Concerto, with its
  certificates and job sheets attached.

The recording shows the path. Only the form capture gives the field identifiers, dropdown
values and validation messages needed to drive it. Together they are about half the call,
and they are what turns this from an estimate into a build.

**Time both.** Start when they open the job, stop when the other system is correct. We
would far rather publish your measured numbers than the industry's ten-to-twenty minutes —
and since the job is typed twice, the case is the sum of both legs.

---

## Before the call — please have ready

- The **coordinator who does this every day**, at their own desk, sharing screen
- **A live example of each**: a Concerto job not yet raised in Joblogic, and a completed
  Joblogic job not yet written back
- **A completed job with its certificate and job sheet on it** — the documents matter as
  much as the fields
- Both logins to hand, and agreement that we may **record**
- Someone who can say **who authorises a user account** on your domain, and who holds MFA

---

## A. How you know there is a job at all

The part no one writes down, and the part that decides whether this can run unattended.

- **How does a new Concerto job reach you** — an email out of Concerto, a queue or list
  view someone opens, a report, a phone call?
- **Who watches it, how often, and in what hours?** What happens overnight and at weekends?
- **How do you tell new from updated?** If the client edits a job after raising it —
  priority, dates, description — does that show up anywhere, or is it only visible if
  someone reopens the record?
- **Is there an accept or acknowledge step** in Concerto, and is there a clock on it? On VX
  the acceptance clock was a separate SLA from the fix clock, and jobs were being missed
  against it while the fix date still looked fine.
- **Cancellations and duplicates** — does the client cancel jobs after raising them? Has
  the same job ever been raised twice?
- **How many arrive a day**, and how spiky is it?

---

## B. Raising it in Joblogic

Watch the coordinator do it once, then walk it slowly.

- **What is copied across**: site, asset, priority, description, target dates, client
  reference, PO, access notes, contacts. Which of these are typed and which are looked up?
- **★ Where does the Concerto reference go on the Joblogic job?** Custom field, customer
  reference, PO field, or in the description? This single field is the key everything else
  matches on for the rest of the job's life. If it is typed by hand, we want to know what
  happens when it is typed wrong.
- **Reference data**: do Concerto's sites and assets map cleanly onto Joblogic's, or does
  the coordinator carry the translation in their head? This is usually the hard part —
  harder than the forms.
- **Priority mapping**: Concerto priority → Joblogic priority and SLA dates. Who decides
  when they disagree?
- **Attachments on the way in**: does the client attach anything to the Concerto job —
  scope, photos, asset list, permits — and does it need to reach the engineer?
- **Anything the coordinator decides rather than copies** — that is judgement, and it
  either becomes a rule we can write down or it stays with a person.

---

## C. What changes after it is raised

- Does the client **update** the job in Concerto once you are working it? Does that need
  to reflect back into Joblogic?
- Do they chase through Concerto, by email, or both?
- Does Concerto expect **progress** before completion — an ETA, an attendance, a status —
  or only the final result?

---

## D. The completion going back

- Which fields are **mandatory**, and what validation fires when they are wrong — we want
  the exact wording
- **Formats** for dates, durations, time on site, costs
- Which dropdown values the desk actually uses, day to day
- Which fields we must **never** touch
- Does completing in Concerto **change status or close** the job, and who is allowed to do
  that?
- **The read-back**: what does the coordinator look at to be satisfied it landed? That view
  is what we compare against — a write is not done until it has been read back.

---

## E. Certificates and job sheets — the part that gets forgotten

Documents are usually where these projects stall, so they get their own section.

- **Which documents have to reach Concerto**: job sheet, service certificate, statutory
  certificate, photographs, waste transfer notes?
- **Where do they come from** — generated by Joblogic, produced by the engineer on the app,
  uploaded by the office, or issued by a third party days later?
- **Do they arrive after the completion?** If a certificate lands three days later, is the
  job written back twice, or held until it is complete?
- **The upload control in Concerto**: accepted types, size limits, one at a time or several,
  and whether a **document type or category** must be chosen on upload.
- **Naming conventions** the client expects, and whether anything must be **signed** before
  it goes.
- Which documents deliberately do **not** go across — internal notes, costs, commercial
  paperwork.

---

## F. Access — what we need, and in whose name

The operator works as one of your users. It must be visible in your directory and
revocable by you.

- An **email account on SEE's domain** for the ProofSync operator
- A **named user login to Joblogic**, and a **named user login to Concerto** — the access
  your coordinator already holds, not a new grant we ask your client for
- **MFA method confirmed** on both, and who holds the second factor
- **Written confirmation from SEE** that using an account this way is authorised, and by whom
- **Read-only to start.** Where a role without write permission exists, use it; where it
  does not, writes stay disabled in configuration, verified before credentials are loaded

**Two minutes worth spending on the call:** sign the same Concerto login in twice, from two
machines. Does the second session evict the first, or lock the record? If it does, the
operator needs its own account rather than sharing the coordinator's.

---

## G. Scope for phase one

- **Which client contract**, and which sites
- **Which leg first** — intake, completion-back, or both
- **Which job types** are in, and which are deliberately out (reactive vs planned, quoted
  works, out-of-hours)
- **Volumes**: jobs in per day, completions per day, and the hours they happen in

---

## H. Decisions we need from you

| Decision | Default we assume |
|---|---|
| Fields that must never be overwritten | Nothing outside the agreed set |
| Do costs transfer? | **No** |
| May we change status or close a job? | **No** — a person closes |
| Approval before close | Required |
| Do we raise Joblogic jobs unattended, or propose them for a person to accept? | **Propose** until you say otherwise |
| Who owns the exceptions queue | A named person at SEE |
| Audit retention | Tell us your requirement |

---

## I. What we will not do

- **Nothing is written to prove that writing works.** The route is proven offline against
  the map. Live writes exist only to do real work.
- **No test record is created in your live system**, and we will not ask for one.
- **MFA is never bypassed.** A person signs in each day and starts the run; the operator
  rides that session. We never hold a password.
- **No reference, or an ambiguous match, raises an exception** — it never guesses.
- Every write is **read back and compared** before it counts as done.

---

## What you leave with

1. The **screen and field map** for both systems, both directions — the asset that makes
   the build possible
2. **Measured** times for both legs, and daily volumes, so the case is yours not ours
3. The **phase plan with dates**: read-only proof → offline build → first attended write

---

## Agenda — 90 minutes

| | |
|---|---|
| 5 min | What we are building, and where it stops |
| 10 min | **How a job reaches you** — monitoring Concerto |
| 20 min | **Watch one job come in** — Concerto → Joblogic, recorded, forms captured |
| 20 min | **Watch one job go back** — completion + certificates, recorded, forms captured |
| 10 min | Access: accounts, MFA, authorisation, the two-session test |
| 10 min | Scope and volumes: contract, job types, which leg first |
| 10 min | Exceptions and policy — what happens when a job does not fit |
| 5 min | Phase plan, dates, who does what next |

---

## After the call

We build against the map, **not against your systems**. The whole journey runs offline
first — both directions, including the paths that fail: no match, ambiguous match, a site
that does not exist in the other system, validation rejection, session expiry. You see
that run and agree it is right before anything points at live.

Then the first live runs are on **real jobs, with a person present, each write approved
before it is submitted.** Per-write approval relaxes only when you have watched enough of
them land correctly and say so. The attended daily sign-in does not relax at all.

Reference: `docs/integration-checklist.md` (§E, the UI route) and `docs/AUTH.md`.

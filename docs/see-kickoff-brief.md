# ProofSync kick-off — what we need out of the session

**SEE · Joblogic → Concerto · ~75 minutes**

We are not scoping this in the abstract. Both systems will be worked the way a
coordinator works them — signed in as a licensed user of yours, through the screens,
the same method already proven on VX Maintain. That means the build is driven by what
is actually on those screens, and none of it is in any documentation.

**The single most valuable outcome is not a discussion. It is a recording of one real
completion being re-keyed by hand, end to end, plus a capture of the Concerto
completion form.** The recording shows us the path. Only the capture gives us the field
identifiers, the dropdown values and the validation messages needed to drive it. Both
take about twenty minutes of the call.

---

## Before the call — please have ready

- The **coordinator who does this every day**, at their own desk, able to share screen
- **One completed Joblogic job that has not yet been entered into Concerto** — a real one
- Both logins to hand, and **agreement that we may record** the screen share
- Someone who can say **who authorises a user account** on your domain, and who holds MFA

---

## A. Watch one job cross — the highest-value twenty minutes

We want to see it done at normal speed, once, without commentary, and then again slowly
with questions. Specifically:

### A1. The matching key
Which **Joblogic field carries the Concerto job reference** — custom field, PO number,
customer reference? Where does the coordinator read it on screen? This is the single
item everything else hangs off: no reference, no match, and the job becomes an exception
rather than a guess.

- What does a job with **no reference** look like, and how often does that happen?
- Has a reference ever matched **more than one** Concerto job?

### A2. The Concerto completion form, field by field
- Which fields are **mandatory**, and what validation fires when they are wrong —
  we need the exact message text
- **Formats**: dates, durations, time on site, costs
- Which dropdown values the desk actually uses, day to day
- Which fields must **never** be touched by us

### A3. Documents
Which certificates and reports go across, where they are retrieved from in Joblogic, and
what the upload control in Concerto accepts — types, size limits, one at a time or many.

### A4. The read-back
**What does the coordinator look at to be satisfied it landed?** That view is what we
compare against. A write is not done until it has been read back — that rule does not
relax because we are driving a screen rather than an API.

### A5. Time it
Start a timer when they open the completed job and stop it when they are satisfied
Concerto is correct. We would rather publish **your measured number** than the industry's
ten-to-twenty minutes. Combined with completions per day, that is the business case, in
your own figures.

---

## B. Access — what we need, and in whose name

The operator works as one of your users. It must be visible in your directory and
revocable by you.

- An **email account on SEE's domain** for the ProofSync operator
- A **named user login to Joblogic**, and a **named user login to Concerto** — the same
  access your coordinator already holds, not a new grant we ask your client for
- **MFA method confirmed** on both, and who holds the second factor
- **Written confirmation from SEE** that using an account this way is authorised, and by whom
- **Read-only to start.** Where a no-write role exists, use it; where it does not, writes
  stay disabled in configuration and that is verified before credentials are loaded

**One test worth two minutes on the call:** sign the same Concerto login in twice, from
two machines. Does the second session evict the first, or lock the record? If it does,
the operator needs its own account rather than sharing the coordinator's — that is a
decision we would rather take now than discover mid-run.

---

## C. Scope for phase one

- **Which client contract**, and which of your sites
- **Which job types** are in, and which are deliberately out
- **How many completions a day**, and in what hours
- Anything seasonal or contractual that changes the volume

---

## D. Decisions we need from you (not now — but before we build)

| Decision | Default we assume |
|---|---|
| Fields that must never be overwritten | Nothing outside the agreed completion set |
| Do costs transfer? | **No**, unless you say otherwise |
| May we change status or close a job? | **No** — a person closes |
| Approval before close | Required |
| Who owns the exceptions queue | Named person at SEE |
| Audit retention | Tell us your requirement |

---

## E. What we will not do

Worth saying plainly, because it is the part that usually goes unasked.

- **Nothing is written to prove that writing works.** The route is proven offline against
  the map. Live writes exist only to do real work.
- **No test record is created in your live system**, and we will not ask for one.
- **MFA is never bypassed.** A person signs in each day and starts the run. The automation
  rides that session; we never hold a password.
- **No reference, or an ambiguous match, raises an exception** — it never guesses.
- Every write is **read back and compared** before it counts as done.

---

## F. What you leave the session with

1. The **screen and field map** for both systems — the asset that makes the build possible
2. A **measured** re-keying time and daily volume, so the case is yours rather than ours
3. The **phase plan with dates**: read-only proof → offline build → first attended write

---

## Agenda

| | |
|---|---|
| 5 min | What we are building and where it stops |
| 20 min | **Watch one job cross** — recorded, with the completion form captured |
| 10 min | Access: accounts, MFA, authorisation, the two-session test |
| 10 min | Scope: contract, job types, volumes, hours |
| 15 min | Exceptions and policy — what happens when it does not fit |
| 10 min | Phase plan, dates, who does what next |
| 5 min | Anything we have not asked about |

---

## After the call

We build against the map, **not against your systems**. The full journey runs offline
first — lookup, extraction, completion form, validation handling, upload, read-back —
including the failure paths: no match, ambiguous match, rejection, session expiry. You
see that run and agree it is right before anything points at live.

Then the first live runs are on **real jobs, with a person present, each write approved
before it is submitted.** Per-write approval relaxes only when you have watched enough of
them land correctly and say so. The daily attended sign-in does not relax at all.

Reference: `docs/integration-checklist.md` (§E, the UI route) and `docs/AUTH.md`.

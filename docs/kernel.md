# The kernel — what actually exists, and what is still a claim

Two CAFMs have now been read the same way, and the thing that made the second one fast was not
the scraper. It was that the questions were already written down. This directory is that, made
explicit: **the operational grammar of FM work, the per-system expression of it, and a checker
that refuses to take either on trust.**

```
kernel/domain.mjs          22 concepts, phrased as questions a machine must answer before acting
kernel/evidence.mjs        every claim points at a captured file; resolve() proves it or does not
kernel/discover.mjs        grade (stated / inferred / absent) × proof, scored separately
kernel/systems/*.mjs       one file per CAFM — Concerto, VX, and a TEMPLATE for the next
kernel/report.mjs          run it:  node kernel/report.mjs --write
```

Run it and you get `docs/kernel-report.md`.

## What it says today

| System | Stated | Inferred | Absent | Unproven | Coverage |
|---|---|---|---|---|---|
| Concerto — Bellrock supplier portal | 20 | 2 | 0 | 0 | **98%** |
| VX Suite — Accruent / Verisae | 16 | 4 | 2 | 0 | **86%** |

Coverage is **not** a quality score for the software. It measures how much of the domain each
system *states outright* rather than leaving to be worked out — which is precisely the work an
operating layer has to do on top of it. A system at 100% would need no inference; every point
below is somewhere the machine has to reason and can therefore be wrong.

**Where they diverge** — the same business fact, held differently:

| | Concerto | VX |
|---|---|---|
| intake | emails the order and logs that it did | no arrival event; discovered by polling |
| acceptance | a stamped event, `Accept within SLA` | inferred from `Pend. Accept` + `Date Assigned` |
| attendance | its own action and its own status | not expressible |
| pause | `Parts On Order`, first-class | `Service Incomplete`, by convention |
| evidence | `Add Note/Document/Photo` | **absent** — photographs are asked for by email |
| exception | inferred (`Currently with`, on cost referral only) | **stated** — 1st and 2nd level escalation fields |

VX is better at escalation than Concerto. Concerto is better at everything to do with evidence and
clocks. Neither is the model; the canonical set is.

## The honesty mechanism

Two judgements are kept apart, deliberately:

- **Grade** — how well the system expresses the concept.
- **Proof** — whether the claim resolves in captures we actually hold.

A `direct` claim whose evidence does not resolve scores **nothing** and prints `UNPROVEN`. And a
claim of *absence* is inverted: it is proven by searching and finding nothing, and **contradicted**
if the thing turns up.

That has already earned its keep. Concerto's `recall` was graded **absent** on my say-so; the
checker found this in a live job description:

> **Recall of QPIZ0019423** — Eng. left x3 tiles broken at Kitchen followed by the last visit on 7/8

So Concerto does express a repeat visit — as a convention in free text, not a link between orders.
Grade corrected to *inferred*. One run of a checker beat a confident paragraph.

## What is built, and what is still a claim

Being straight about the six layers, because the gap between them is the whole risk:

| Layer | State |
|---|---|
| 1 · Domain model | **Built.** `domain.mjs`, 22 concepts, weighted by what it costs to be wrong. |
| 2 · Discovery | **Half.** The capture passes are real but bespoke per system — a scripted read-only crawl, not a generic prober. What is generic is the *question set*, which is the part that made the second system quick. |
| 3 · Canonical model | **Built for state.** Canonical states plus per-system mappings; both systems normalise into one vocabulary. |
| 4 · Client operating harness | **Partly, elsewhere.** Terri's policies, waits, escalation ladders and atomised knowledge live in the other repo and are not yet expressed against this domain. |
| 5 · Execution | **Built for one system.** Browser-driven writes, batching and delivery exist for VX. Nothing executes against Concerto and nothing should until a person asks it to. |
| 6 · Trust | **Built for one system.** Write ledger `INTENDED → SUBMITTED → CONFIRMED \| UNKNOWN`, read-back verification, replay harness, 416 tests. Unverified writes return failure rather than passing as success. |

## The caveat that matters

Two systems is a pattern of two. This proves **transfer**, not universality: the questions were
written *beside* VX and Concerto, so of course they fit them.

The falsifiable test is `kernel/systems/TEMPLATE.mjs`. Point a read-only pass at a third CAFM,
answer the same questions, and one of three things happens. Only the first is good news:

1. Most concepts map and the evidence resolves — the grammar holds.
2. Concepts map but evidence will not resolve — we are remembering, not reading.
3. The third system has important concepts with **no slot here** — the domain is too narrow, and it
   has to be widened and the other two re-run.

Outcome 3 is the interesting one, and it must not be quietly smoothed over. A domain model that can
only ever be added to, never contradicted, is two case studies with a table on top.

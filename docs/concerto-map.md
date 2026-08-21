# Concerto (Bellrock) — what the supplier side looks like

Read from SEE's own helpdesk login, 21 August 2026, attended. Nothing written.

**The chain.** Costa Coffee is the client. **Bellrock** is the managing agent and owns
Concerto. **SEE Services Ltd** is the supplier. So SEE sees Concerto through a *supplier
portal* — the jobs assigned to them — not the client's whole estate.

The account covers four supplier entities: **SEE Services Ltd**, plus *South Eastern Services
(Mechanical)*, *(Building)* and *(Electrical)*. Anything we build has to expect all four.

**And SEE hold more than one client inside Bellrock.** Costa Coffee is the one on the sample
order; the 12,207 live orders are not all theirs. That cuts two ways and both matter:

- **In our favour.** One Concerto connector reaches every Bellrock client SEE work for. The
  integration is built once and its value multiplies by the number of those clients, which is
  the opposite of the usual FM integration story where each client is a fresh build.
- **Against a naive build.** Nothing may assume a single client. The intake leg has to know
  which client an order belongs to, because that decides which Joblogic contract it is raised
  against, which SLA applies, and which of SEE's four entities holds it.

So the first scoping question is not "which client do we start with" but **"how does Concerto
say which client an order belongs to"** — a column, a filter, or something only implied by the
site. Nothing in the visible grid names it: the client appears inside the Description text
(`43041755: Costa Coffee York Eboracum Way DT`), which is not a field.

---

## The matching key already exists, and it is theirs to fill

The order list carries a **`Supplier's ref`** column, beside Concerto's own `Order number`.

That is the field the Joblogic job number belongs in — the cross-system key ProofSync needs,
writable from the supplier side, no custom field required and nothing to ask Bellrock for. It
is the Concerto equivalent of the question we were going to spend twenty minutes of the
kick-off on ("where does the Concerto reference live in Joblogic?"), answered from the other
direction: **each system can hold the other's reference, and Concerto's slot is already there.**

Whether SEE currently populate it is the first thing to ask.

---

## Scale, from the portal's own counters

| | |
|---|---|
| Orders currently live | **12,207** |
| Quotation requests awaiting submission | **103** |
| PPM/FM activities overdue | 13 |
| PPM/FM within the next 2 weeks | 68 |
| PPM/FM within the next 3 months | 619 |
| Messages from client | 1 |

And from the dashboard tiles, which are the queue as Concerto presents it:

- **Critical orders:** 9 in progress, with Awaiting Acceptance / Breaching SLA within 2 Hours /
  Overdue / Requiring Action to Complete across the top.
- **Urgent reactive (≤24h SLA):** 0 awaiting acceptance, 0 breaching within 2 hours,
  **4 overdue**, **6 requiring action to complete**, 7 in progress.
- **PPM orders:** **371 due within 6 weeks without an appointment** against **1 with** one,
  0 awaiting certificate, 0 passed back to supplier, **17 overdue**.

Those tiles are the whole ProofSync loop written as counters: *Awaiting Acceptance* is intake,
*Breaching SLA within 2 Hours* is the accept clock, *Requiring Action to Complete* is the
completion leg, *Awaiting Certificate* and *Passed Back to Supplier* are the documents.

**371 PPMs due inside six weeks with no appointment** is the largest number on the page, and it
is a scheduling problem rather than a chasing one — worth knowing before we build a chaser.

---

## The order list

Columns, left to right: select box · row menu · **Order number** · **Supplier's ref** ·
Description · Activity description · Order date · Order Priority · **Response required/actual**
· **Completion required/actual** · Status · Parent job status · Call type · **Mandate** ·
Cost uplift · **Operative(s)** · **Appointment**.

Notes on those:

- **Response and completion each show required AND actual**, side by side, coloured when missed.
  VX makes you work that out; Concerto states it.
- **Mandate** (£250.00 on the sample) is the spend limit — the NTE equivalent.
- **Operative(s)** names the engineer, so the client can see who attended.
- **Parent job status** implies a parent/child structure above the order.
- An **ACTIONS** menu sits above the table, and every row has its own **⋮** menu. Those are the
  write path and the next thing to capture.

## An order

`RCST0306081/1` — a live example, read only:

| Field | Value |
|---|---|
| Order date | 18 Aug 2026 |
| Current status | Attended |
| Location of work | Costa Coffee York Eboracum Way DT, Drive Thru, Eboracum Way, York, YO31 7RE |
| Originator | `43041755@costacoffee.co.uk`, mobile 01904 946964 |
| Asset type | **Electrical & Lighting : Circuit Board / Fault** |
| Priority of response | 4 Hour |
| Date acknowledged | 18 Aug 2026 08:09 |
| Response time required | 18 Aug 2026 09:39 |
| Completion time required | 18 Aug 2026 17:39 |
| Appointments | Tue 18 Aug 08:00 → 09:00 |

**Date acknowledged is the accept step**, and it is stamped — so unlike VX, acceptance is
visible as a fact rather than inferred from a status. The asset type is a two-level taxonomy
(`Category : Item / Fault`).

---

## Still to capture

1. The **ACTIONS** menu on an order — Concerto's equivalent of VX's Select an Action, and the
   list of what a supplier may do.
2. The **row ⋮ menu** on the order list.
3. **The rest of the order screen** below the fold — where notes, job sheets and documents live.
4. The **Search** panel on the Orders tab: what can be filtered, which is what a driver would
   query.
5. **PPM certificate reviews** — the certificate leg.
6. Whether `Supplier's ref` is populated today.

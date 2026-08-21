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

**Answered, by reading the portal's own filters.** The client is not a column — it is a
**Client workspace** selector on the search panel (`pbl_form_dba_portfolioid`), and it holds
**nineteen real clients**:

> ADI Global · Arriva UK Bus · Bidfood · Boparan · Capco · Coaching Inn Group · **Costa Coffee**
> · Dulux Decorating Centre · Hertz UK · Lakeland · Pizza Express · RedCat Pub Company ·
> St John Ambulance · The Big Table Group · The Restaurant Group · Volvo UK · wagamama · YODEL
> (plus a Bellrock Test workspace)

That is the whole commercial argument for this integration in one dropdown. Costa Coffee is not
the job — it is one nineteenth of it, and the connector is written once.

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

## The search panel — what a driver can actually query

From the supplier portal, read off the live page:

| Filter | Field id | Values |
|---|---|---|
| Search field | — | Order number · Order description · **Supplier reference** · **Client reference** · Job reference · Site |
| Type of works order | `pbl_form_dba_type` | All · Planned · Reactive · Remedial |
| Status of work order | `pbl_form_dba_status` | Attended · In progress · **Parts On Order** · Work complete |
| Client workspace | `pbl_form_dba_portfolioid` | the nineteen clients above |
| Appointment | `pbl_form_dba_appoint` | All · Without appointment · With appointment |
| PPM Tag | `pbl_form_dba_ppm_tagid` | 32 disciplines — Fire, Gas, F Gas, Water, LOLER, Asbestos, Catering Equipment, Air Conditioning / Fridges / Freezers … |

**`Supplier reference` is searchable.** That closes the loop: ProofSync writes the Joblogic
number into `Supplier's ref` on the way in, and finds the order again by searching that field on
the way back. No custom integration key, no lookup table of our own, and reconciliation after a
crash is a search rather than a guess.

`Parts On Order` as a first-class status is worth noting too — VX has no such state, which is
why a paused job there has to be inferred from a note.

## The other screens

- **PPM certificate reviews** — `PPMSupplierReview.aspx`, columns: PPM · UPRN · Site · Status ·
  Order number · Date required · Date complete. **UPRN** is the property identifier, which is a
  better join key than a site name. This is the certificate leg of the loop.
- **Cost referral** — `contractjob.aspx`, columns: Ref · Task order · Title · Raised by ·
  **Currently with** · Cost referral date · Date raised · Date issued · Estimate · Stage
  deadline date. "Currently with" states whose court the ball is in, which is exactly what
  Terri has to infer on VX. Its own search adds *Helpdesk job reference* and *Record Reference*.
- **PPM and activities** — `site_scheduler.aspx`, a scheduler keyed by site, with sites named
  `Aberdeen - Airport Turnaround : ABZ050` — a site code convention we can match on.

## An order, read in full

`RCST0305401/1`, Costa Coffee Barnard Castle, read from the live portal:

| Field | Value |
|---|---|
| Order date | 21 Aug 2026 |
| Current status | In progress |
| Location of work | full site name and address |
| Originator | `43025715@costacoffee.co.uk`, mobile 01833 600096 |
| Asset type | `Electrical & Lighting : Circuit Board / Fault` |
| Priority of response | **3 Working Day (excluding weekends)** |
| Date acknowledged | 21 Aug 2026 13:13 |
| Response time required | 26 Aug 2026 12:47 |
| Completion time required | 28 Aug 2026 12:47 |
| Initial request | the caller's own words, verbatim |
| **Access details** | opening hours and address, as its own field |

Tabs: **Notes and Activities · Permits · Invoices and Applications**. Controls: *Back to order
list*, *Actions* (`#dropdownMenuButton`), *More detail*.

### How a job actually arrives — from the activity feed

The feed on that order, in order, is the answer to "how do you know there is a job":

```
21 Aug 12:47:51  Order RCST0305401/1 added against helpdesk reference RCST0305401
21 Aug 12:47:56  Order RCST0305401/1 emailed to helpdesk@see-services.com
21 Aug 13:13:32  Order RCST0305401/1 : Accept within SLA
```

**Concerto emails the order to SEE's helpdesk mailbox, and records that it did.** So the intake
trigger is an email, the portal is the system of record for it, and the acceptance twenty-six
minutes later is itself a logged action — "Accept within SLA", attributed to the mailbox.

That is worth more than it looks:

- **Intake can be driven from the mailbox or from the portal**, and the two can be reconciled,
  because Concerto states that it sent the mail and when.
- **Acceptance is an event with a name and a clock**, not a status to be inferred. Compare VX,
  where acceptance had to be reconstructed from `Date Assigned`.
- **`Priority of response` is a phrase, not a code** — "3 Working Day (excluding weekends)" —
  so the working-day arithmetic is the client's, and any clock we run has to match it rather
  than counting calendar hours.

## How a Concerto row opens — for the connector, not just for us

The grid rows are not links. The markup is:

```html
<tr role="link" tabindex="0"
    onkeypress="PblActions.selectRowOnEnterKey(event,'RenderOrderSummaryConst')">
```

**Focus the row and press Enter.** Three separate click attempts did nothing, because nothing
is bound to a click — and the order then opens in a way that left an earlier version of this
script watching the wrong page while the record was on screen. Both facts belong in the
connector, not in a comment in a script somebody deletes.

## Still to capture

1. The **Actions** menu contents (`#dropdownMenuButton`) — the list of what a supplier may do,
   which is the write path. Four attempts to open it from script failed; it is a screenshot.
2. The **row ⋮ menu** on the order list.
3. What sits under **Permits** and **Invoices and Applications**, and where a job sheet or
   certificate is attached.
4. Whether `Supplier's ref` is populated today.

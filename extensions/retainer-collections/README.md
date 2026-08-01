# Retainer Collections — Manager.io extension

A report that lists **retainer collections by client (cash basis)** for a chosen
month, straight inside Manager.io. It replaces the old
"export → paste into ChatGPT → get a report" workflow.

It reproduces exactly what Manager's cash-basis P&L already shows: for the
retainer income account, it takes the account drill-down, nets each invoice
(**Credit − Debit = cash collected this period**), drops the untouched invoices,
groups the rest by client, and totals it — tying out to the penny with the P&L
figure.

*Verified against July 2026: 402 invoices, ₱1,031,087.36 — matches the P&L line
`Client Retainer Charges – Monthly`.*

## Files
- `index.html` — the extension UI.
- `engine.js` — the import transform logic (kept separate so it can be unit-tested).
- `cashbasis.js` — the experimental records-based reconstruction (see bottom).
  Host all files together; the built single-file in `dist/` inlines them.

## How to run it (the supported path)
In Manager, open the cash-basis ledger for the period — a single-account
drill-down, **or** the *General Ledger Transactions* report with an **Account**
column for multiple accounts — select the table and **copy**, then **paste** it
into the box (or drop a **.csv**) and click **Build report**.

- **Reconciles to the penny.** It nets each invoice (**Credit − Debit = cash
  collected**), drops untouched invoices, groups by client, and totals — matching
  the P&L. *Verified July 2026: 402 invoices = ₱1,031,087.36.*
- **Date range** — optional From/To filter (e.g. Jan 1 – Mar 31, 2026).
- **Multiple accounts** — include an **Account** column and an account picker
  appears: tick 2+ accounts for **per-account subtotals + a grand total**.
- **Private** — nothing leaves the browser; no ChatGPT, no upload.
- Export **CSV** / **Print → PDF**.

## Experimental: live mode (does not reconcile)
A hidden "experimental live mode" link (page footer) reveals a records-based
reconstruction that pulls receipts + invoices via the API and attributes each
payment to the retainer account proportionally, net-of-tax. **It does not tie to
the P&L** and is not the supported path: Manager recognises retainer income when
it applies payments — including client **advances** applied to each month's
invoice, which have no receipt in the period — so a receipts-based reconstruction
structurally undercounts (~60% on July 2026). Kept for R&D only.

Both modes produce the same on-screen report with **Export CSV** (account
subtotals included) and **Print / Save PDF** buttons.

## Install into Manager.io
1. Host this folder so `index.html` has a public URL. Easiest: a GitHub repo →
   **Settings → Pages → Deploy from branch → main** → you get
   `https://<you>.github.io/<repo>/`.
2. In Manager: **Settings → Extensions → Add New Extension** → paste that URL.
3. Open it from the Extensions/report area, choose the month, and run.

(You can also just open `index.html` locally in a browser and use the
**Paste / import** tab — live mode only works inside Manager.)

## How the numbers are derived
| Case | Meaning | Where it lands |
|------|---------|----------------|
| `Credit − Debit > 0` | cash received this month | **Paid Retainers** |
| `Credit − Debit < 0` | refund / reversal | **Adjustments** |
| `Credit − Debit = 0` | invoice untouched this month | dropped |

`Gross collections + Adjustments = Net = total Credits − total Debits` in the
source — shown live in the **Reconciliation** panel with a ties-out check.

## Test
`engine.js` is pure and Node-testable. Point the harness at a CSV export of a
retainer drill-down:

```bash
node test/run.js "/path/to/retainer charges detail_cash basis.csv"
```

It prints the totals and asserts the reconciliation (Gross + Adjustments = net
Credit − Debit).

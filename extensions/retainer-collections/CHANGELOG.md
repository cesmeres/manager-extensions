# Changelog — retainer-collections

All notable changes to this extension. Versioning follows [SemVer](https://semver.org).

## [1.3.0] — 2026-08-01
### Changed
- **Import is now the primary, supported path** — it reconciles to the cash-basis
  P&L exactly (verified July: 402 invoices = ₱1,031,087.36) with a single paste,
  and supports multi-account subtotals, date range, CSV and PDF.
### Added (experimental, hidden)
- A **records-based live mode** that reconstructs cash-basis collections from
  receipts→invoices (proportional, net-of-tax). Reachable via the "experimental
  live mode" footer link. **It does NOT tie to the P&L**: Manager recognizes
  retainer income when it applies payments (including client *advances* applied
  to each month's invoice), which have no receipt in the period — so a
  receipts-based reconstruction structurally undercounts (~60% on July). Kept for
  R&D; not the supported path. Includes the P&L-account selector and diagnostics.

## [1.2.2] — 2026-08-01
### Fixed
- Unwrap the api4 { key, item } envelope — real fields live in `item`. This is why accounts/GL came back empty. Accounts now load from `profit-and-loss-statement-account-batch`; GL fields read from `item`.
- Diagnostics now show the unwrapped `item` field names.
- Dropped the firm-name override (the businesses list returns all businesses, not the current one).

## [1.2.0] — 2026-08-01
### Added
- **P&L account selector** in live mode — loads your Profit & Loss accounts from
  the API (`profit-and-loss-statement-account-batch`, with fallbacks) so you tick
  the retainer account(s) instead of typing a name. Search box, "tick Retainer",
  and clear. Accounts auto-load on connect.
### Changed
- Live GL rows are now matched to the selected accounts by **account key/name**
  (resolving key→name), fixing "no rows matched" when the ledger returns the
  account as a reference rather than its display text.
- Data inspector now reports the accounts-list source, counts, and the distinct
  account values seen in the ledger.
### Removed
- The free-text "Accounts to include (name contains)" box (replaced by the selector).

## [1.1.0] — 2026-08-01
### Added
- **Multiple accounts** with an account picker — tick 2+ income accounts to get a
  **subtotal per account** plus a **grand total**. Ticking/unticking re-renders
  instantly and recomputes the grand total + reconciliation.
- **Date range** (From/To) instead of a single month — e.g. Jan 1 – Mar 31, 2026.
- Import mode reads an optional **Account** column (for per-account subtotals) and
  an optional date-range filter; CSV export now includes account subtotals.
### Changed
- Engine `transform()` now groups by `(account, invoice)` and returns per-account
  breakdowns with a `grandSummary()`; single-account sources render as before.

## [1.0.0] — 2026-08-01
### Added
- Cash-basis "retainer collections by client" report for a chosen month.
- **Load from Manager** mode via the postMessage bridge (`general-ledger-transactions-batch`),
  with auto field-detection and a Data inspector for first-run confirmation.
- **Paste / import** mode (copy the account drill-down, or drop a CSV) — fully
  offline, always reconciles.
- Per-client subtotals, Adjustments/Reversals section, live reconciliation
  ties-out check, CSV export, Print/PDF.
- Verified against July 2026: 402 invoices, ₱1,031,087.36 — matches the P&L.

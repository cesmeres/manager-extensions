# Changelog — retainer-collections

All notable changes to this extension. Versioning follows [SemVer](https://semver.org).

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

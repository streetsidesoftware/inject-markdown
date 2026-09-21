# ADR-0005: Auto-alignment by content type

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Beyond the explicit alignment markers in `columns` ([ADR-0003](0003-table-columns-option.md)), we want columns whose values are clearly numeric or currency to right-align automatically, without requiring the author to annotate every such column by hand. This only affects columns the author left unmarked.

## Decision

**Scope of detection:** a column's *data rows* (within the active row window, [ADR-0004](0004-table-row-window-options.md); never the header text) are inspected, ignoring empty cells.

**Pattern matched as "numeric/currency":**

- Optional leading `+`/`-` sign.
- Optional currency symbol from a fixed set as a prefix: `$`, `€`, `£`, `¥`.
- Digits with a thousands/decimal separator, tolerant of both conventions so the same detector works for `1,234.56` and `1.234,56` — a value is accepted if it parses cleanly under *either* interpretation.
- Optional trailing `%`.
- No ISO currency codes (`USD 5`), no other symbols (₹, ₩, etc.) — fixed set only, matching [ADR-0001](0001-table-option-encoding-conventions.md)'s general v1 bias toward a small, explicit ruleset over broad locale coverage.

**Threshold:** a column is right-aligned if **≥90%** of its non-empty data-row values match the pattern above. This tolerates a handful of stray non-numeric rows (e.g. an occasional `N/A` or footnote) without losing alignment for an otherwise-numeric column, while still leaving genuinely mixed/textual columns left-aligned (the GFM default).

**Precedence:** an explicit alignment marker from `columns` (`:Name`, `Name:`, `:Name:`) always overrides auto-detection for that column — auto-alignment only ever fills in columns with no explicit marker, per [ADR-0003](0003-table-columns-option.md). This applies whether or not the `columns` option is present at all.

**Alignment direction:** auto-detection only ever produces right-alignment (never center/left) — matching the spec's stated intent ("should be right aligned") and the conventional reading of numeric columns in tables.

## Options Considered

- **Numbers only, no currency symbols (v1-minimal)** — considered, but the feature was explicitly requested to cover "currency," so the fixed-symbol-set approach was chosen instead of deferring it.
- **Symbol-agnostic detection** (treat any consistent single leading/trailing non-digit character as a currency marker) — rejected: more general, but risks false positives on things like a units column (`5kg`, `10cm`) that isn't currency at all; a fixed, known symbol set is safer and easier to reason about.
- **Strict: all non-empty cells must match (0% tolerance)** — rejected: one stray `N/A` would silently flip a whole column back to left-aligned, defeating the point of "look mostly numeric."
- **All-or-nothing including empty cells** — rejected: would make any blank cell in the column disqualify it, which is overly strict for typical sparse CSVs.
- **Single locale convention only (US-style comma-thousands/period-decimal)** — rejected in favor of tolerant dual-parsing, since currency-formatted exports commonly use either convention and rejecting one wholesale would undercut the "currency" half of the feature.

## Consequences

- Auto-alignment requires a full pass over each unmarked column's values (within the row window) before the table can be emitted, since the alignment row must be decided before/alongside the header+body rows — this couples table construction more tightly to a first full read of the data than today's straight pass-through.
- Because detection is heuristic (≥90% threshold, dual-locale number parsing), the same source file can appear to "flip" alignment if enough new non-numeric rows are appended over time — a behavior worth documenting so it isn't mistaken for a bug when a previously-numeric column later contains more exceptions than the threshold allows.
- The fixed currency-symbol set ($, €, £, ¥) means other currencies' native symbols won't trigger right-alignment; this is an accepted v1 limitation, not an oversight — extending the set is a low-risk follow-up if requested.

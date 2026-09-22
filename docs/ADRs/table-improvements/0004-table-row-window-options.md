# ADR-0004: Row window options (`start-row`, `end-row`, `num-rows`)

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Large CSV/TSV sources need a way to inject a bounded slice of rows — both to keep generated Markdown readable and to cap accidental injection of huge files. Table injection already supports `#L1-L10` (`lines`, parsed in [hash.ts](../../../src/util/hash.ts) and applied via `extractLines` in [FileInjector.ts](../../../src/FileInjector/FileInjector.ts)), which slices _raw source lines_ before parsing. The new options need clear semantics of their own and a clear relationship to `lines`.

## Decision

**Numbering base:** `start-row` and `end-row` are 1-based and count **data rows only** — i.e., row 1 is the first row after all `header-rows` rows have been stripped ([ADR-0002](0002-table-header-rows-option.md)), never a header row itself and never a raw file line.

**Relationship to `lines`/`#L1-L10`:** orthogonal, applied in sequence, and both may be combined on the same directive:

1. `lines` (if present) slices raw file text, pre-parse — unchanged from today.
2. The resulting text is parsed into rows and `header-rows` are stripped.
3. `start-row`/`end-row`/`num-rows` then window the remaining data rows.

**Defaults and formula:**

- `num-rows` defaults to `10,000` — a count of rows, not an offset.
- `start-row` defaults to `1`.
- `end-row`, if given, is the inclusive last data row number.
- Effective last row = `min(start-row + num-rows - 1, end-row)` when `end-row` is given, else simply `start-row + num-rows - 1`. E.g. `start-row=1`, `num-rows=10000` (defaults), no `end-row` → rows 1 through 10,000 inclusive.

**Edge cases — both treated as an empty result, not an error:**

- `start-row` beyond the last available data row → the output table has its header row(s) but zero data rows.
- `end-row < start-row` (whether from explicit values or from the derived formula) → same: header-only table.

This mirrors how an empty/short CSV already produces a header-only or empty table today — an empty selection is a valid, if unusual, outcome rather than a misconfiguration.

## Options Considered

- **Row numbers counted from the raw file (including header rows)** — rejected: would force every `start-row` to account for `header-rows`, which is error-prone whenever `header-rows` changes; counting from the first data row is more stable and matches the spec's own wording ("starting row after the header rows").
- **Mutually exclusive with `lines`** — rejected: `lines` operates on raw text (useful e.g. to skip a leading comment block a delimited parser can't handle), while the row-window options operate on parsed data rows; forcing a choice between them would remove legitimate combined use (e.g. `lines` to cut a preamble, then `start-row`/`num-rows` to page through the remaining data).
- **New options replace `lines` for tables** — rejected for the same reason; `lines` still has a distinct job.
- **Error on out-of-range window** — rejected in favor of empty-table-body, consistent with [ADR-0001](0001-table-option-encoding-conventions.md)'s general preference to fail loudly on _directive_ mistakes (bad column refs) but not on data-dependent conditions (a source file that's shorter than expected isn't necessarily a directive bug — e.g. a growing/shrinking log-derived CSV).
- **Literal formula as originally spec'd** (`max-row = min(start-row + num-rows, end-row)`, i.e. last row = `start-row + num-rows` with no `-1`) — rejected: would make `num-rows`'s default of 10,000 yield 10,001 rows starting from row 1, an off-by-one that doesn't match "num-rows" reading as a count.

## Consequences

- `readAndParseTableFile` in [FileInjector.ts](../../../src/FileInjector/FileInjector.ts) needs a second slicing step operating on parsed rows (post `rowsToTable`'s row split, pre-render), in addition to the existing raw-line `extractLines` step.
- A silent empty-table-body result for an out-of-range window means a typo in `start-row` (e.g. `start-row=100` on a 20-row file) won't surface as an error — only as an unexpectedly empty table in the rendered Markdown. Worth a callout in user docs; can be revisited if this proves to hide real mistakes in practice.

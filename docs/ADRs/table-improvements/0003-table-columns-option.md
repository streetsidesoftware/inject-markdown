# ADR-0003: `columns` option

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Today every column in a CSV/TSV source is injected, in source order, unaligned. `columns` lets an author select a subset of columns, reorder them, and mark per-column alignment — without editing the source file. Builds on the encoding conventions in [ADR-0001](0001-table-option-encoding-conventions.md) and the header semantics in [ADR-0002](0002-table-header-rows-option.md).

## Decision

**Value syntax:** `columns=<ref>[,<ref>...]`, a comma-separated list (optionally the whole value double-quoted to allow literal spaces per ADR-0001). The output table has exactly these columns, in this order — columns not listed are omitted entirely.

**Column reference (`<ref>`) grammar:**

- A bare 1-based number (`3`) referencing the column by source position, or
- A name (`Price`) matched against the *first* header row's text for that column ([ADR-0002](0002-table-header-rows-option.md)). Names are unavailable when `header-rows=0`.
- Either form may carry an alignment marker as a leading and/or trailing colon, mirroring GFM's own `:---` / `---:` / `:---:` delimiter-row syntax:
  - `:Name` → left-align
  - `Name:` → right-align
  - `:Name:` → center-align
  - `Name` (no colon) → no explicit alignment; falls through to auto-alignment ([ADR-0005](0005-table-auto-alignment.md))

**Examples:**

```
#columns=Name,Age:,Price:
#columns=3,1,2:
#columns="First Name,Age:,:Notes:"
```

**Validation (all fail the injection per ADR-0001's error posture):**

- A number outside `1..sourceColumnCount` is an error.
- A name with no matching header (typo) is an error.
- Under `header-rows=0`, any non-numeric reference is an error — there is no header text to match, so a name-shaped entry can only be a mistake.

**Duplicates and ambiguity** (per ADR-0001): repeating a reference duplicates that column in the output; if a name matches multiple columns (duplicate header text in the source), the first match wins.

**Alignment precedence:** an explicit marker from `columns` always wins over auto-alignment for that column; auto-alignment ([ADR-0005](0005-table-auto-alignment.md)) only fills in columns the author left unmarked. This applies whether or not `columns` is present at all — omitting `columns` entirely still allows auto-alignment across all (unmarked) columns.

## Options Considered

- **Repeated-key list (`columns=Name&columns=Age`)** — rejected in [ADR-0001](0001-table-option-encoding-conventions.md); comma-separated is more natural to author.
- **Rename columns via `columns`** (e.g. `columns=Price=Cost`) — considered but out of scope: the spec only calls for select/reorder/align, not rename. Left as a candidate follow-up ADR if requested later.
- **Silently drop unmatched/out-of-range refs** — rejected; fails fast on typos instead (ADR-0001).
- **Alignment marker as a suffix code letter (`Price:R`)** — rejected in favor of the GFM-mirroring colon-prefix/suffix form, since it reads visually closer to the Markdown alignment syntax users already know.

## Consequences

- `Table.ts`'s `rowsToTable` needs a column-selection/reorder/align pass ahead of (or integrated with) table construction, driven by parsed `columns` refs resolved against the header-row(s) and source column count.
- The `align` array GFM emits (currently `new Array(columnCount).fill(null)`) becomes per-column and driven by both explicit markers and, per [ADR-0005](0005-table-auto-alignment.md), content-based inference.
- A `columns` directive is now schema-coupled to the source file's column count and (if using names) header text — a source file restructure requires updating any Markdown files that reference it by name or number, per the tradeoff already accepted in ADR-0001.

# ADR-0002: `header-rows` option

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

`rowsToTable` ([Table.ts](../../src/FileInjector/Table.ts)) currently always treats the first parsed row as the header. We need a `header-rows` option so authors can declare zero header rows (columns addressed only by number) or more than one (e.g. a two-row header where row 1 is a group label and row 2 is the sub-column name).

See [ADR-0001](0001-table-option-encoding-conventions.md) for the shared bare-flag and error-handling conventions this option follows.

## Decision

- `header-rows=N` declares the first `N` parsed rows (after any `#L1-L10` raw-line slicing, see [ADR-0004](0004-table-row-window-options.md)) as header rows. Default: `1` (matches today's behavior).
- Bare `#header-rows` (no value) means `header-rows=1` — an explicit shorthand for the default, useful mainly for readability/self-documentation in a directive that also sets other options.
- `header-rows=0`: no header row is read from the source file at all. Every parsed row is a data row, and columns can only be referenced by number in `columns` ([ADR-0003](0003-table-columns-option.md)) — there's no header text to match a name against. The emitted table still needs a valid GFM header/separator row, so the header cells are synthesized as the column's own 1-based number (`1`, `2`, `3`, ...) — the same numbers used to reference that column in `columns`, keeping the numbering visible and self-consistent rather than emitting blank or invented labels.
- `header-rows=N` for `N > 1`: all `N` rows are consumed as header rows. Per column, the header cells across those `N` rows are joined into a single output header cell using `<br />` as the separator (e.g. rows "Unit" / "Price" become one header cell reading `Unit<br />Price`), so the emitted table still has exactly one header row + one GFM alignment row, regardless of how many source rows fed it.
- **Name matching uses row 1 of the header block only.** `columns=Price` matches against the text of the *first* header row for that column, never the `<br />`-joined display text and never any other header row. This was revisited mid-design: matching against the joined text (`columns=Unit<br />Price`) was rejected because it forces authors to embed literal HTML in a directive just to reference a column, which is unpleasant to type and easy to get wrong (whitespace/casing inside the joined string).

## Options Considered

- **Match `columns` against joined multi-row header text** — initially chosen, then reversed: awkward authoring (see above) outweighed the benefit of one canonical match string.
- **Match `columns` against any header row (row 1 through N)** — rejected: more flexible but ambiguous when two different header rows could each independently match the same or different columns; first-row-only is unambiguous and predictable.
- **Blank header cells for `header-rows=0`** — rejected in favor of numbered headers, which keep the visible column numbering aligned with what `columns=` accepts, aiding readers who want to reference a column later.
- **No header row/separator at all for `header-rows=0`** — rejected: GFM tables require a header + delimiter row to render as a table at all; synthesizing numbered headers avoids inventing a special non-table output shape.

## Consequences

- `Table.ts`'s `rowsToTable` needs to accept a header-row-count parameter (currently hardcoded to 1 row) and multi-row-join logic; it currently assumes `[header, ...body] = rows`.
- Renaming a source column's first header row silently changes what `columns=Name` matches, even if a second header row (in a 2+ row header) still visually looks unchanged — an authoring footgun worth a callout in user-facing docs.
- `header-rows` interacts with [ADR-0004](0004-table-row-window-options.md)'s row numbering: `start-row=1` always means the first row *after* all header rows are stripped, regardless of `header-rows`'s value.

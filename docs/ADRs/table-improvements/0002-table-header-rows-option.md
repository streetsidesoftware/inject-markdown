# ADR-0002: `header-rows` option

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

`rowsToTable` ([Table.ts](../../../src/FileInjector/Table.ts)) currently always treats the first parsed row as the header. We need a `header-rows` option so authors can declare zero header rows (columns addressed only by number) or more than one (e.g. a two-row header where row 1 is a group label and row 2 is the sub-column name).

See [ADR-0001](0001-table-option-encoding-conventions.md) for the shared bare-flag and error-handling conventions this option follows.

## Decision

- `header-rows=N` declares the first `N` parsed rows (after any `#L1-L10` raw-line slicing, see [ADR-0004](0004-table-row-window-options.md)) as header rows. Default: `1` (matches today's behavior).
- Bare `#header-rows` (no value) means `header-rows=1` — an explicit shorthand for the default, useful mainly for readability/self-documentation in a directive that also sets other options.
- `header-rows=0`: no header row is read from the source file at all. Every parsed row is a data row, and columns can only be referenced by number in `columns` ([ADR-0003](0003-table-columns-option.md)) — there's no header text to match a name against. The emitted table still needs a valid GFM header/separator row, so the header cells are synthesized as the column's own 1-based number (`1`, `2`, `3`, ...) — the same numbers used to reference that column in `columns`, keeping the numbering visible and self-consistent rather than emitting blank or invented labels. This applies to the GFM pipe form only; an `#html-table` table has no `<thead>` here ([ADR-0010](0010-table-html-table.md)).
- `header-rows=N` for `N > 1`: all `N` rows are consumed as header rows. Per column, the header cells across those `N` rows are joined into a single output header cell using `<br />` as the separator (e.g. rows "Unit" / "Price" become one header cell reading `Unit<br />Price`), so the emitted table still has exactly one header row + one GFM alignment row, regardless of how many source rows fed it. This applies to the GFM pipe form only; an `#html-table` table emits `N` real header rows ([ADR-0010](0010-table-html-table.md)).
- **Name matching uses a whitespace-joined concatenation of all header rows for that column, not the `<br />`-joined display text.** For each column, take that column's cell text from every header row, drop any blank/empty cells, and join the remaining non-empty parts with a single space — this is a separate string from the `<br />`-joined _display_ text in the bullet above. E.g. for a two-row header where column 2 reads "Name" / "First" and column 3 reads "Name" / "Last" (row 1: `Date,Name,Name,Value`; row 2: `,First,Last,`), the match strings are `Date`, `Name First`, `Name Last`, `Value` — so `columns="Name First,Name Last"` selects and reorders those two columns. This revises the original decision (below) to match against row 1 only, which turned out to be too restrictive once group-header layouts (a shared label in row 1 over per-column sub-labels in row 2) came up as a real case.
- **Matching is whitespace-normalized and case-sensitive.** Before comparing, both the computed match string and the user-supplied reference in `columns` have runs of whitespace collapsed to a single space and are trimmed — this applies uniformly, whether the extra whitespace came from joining rows together or was already inside a single header cell's own text (e.g. a cell literally containing `"Unit  Price"` matches `columns=Unit Price`). Casing is not normalized: `columns=name` will not match a header of `Name`, consistent with [ADR-0001](0001-table-option-encoding-conventions.md)'s general preference for predictable, fail-fast matching over forgiving/fuzzy matching. In a `#markdown` or `#html-table` table, each header cell contributes its rendered plain text rather than its Markdown source; see [ADR-0009](0009-table-markdown-interactions.md).

## Options Considered

- **Match `columns` against the `<br />`-joined display text** — rejected: forces authors to embed literal HTML in a directive just to reference a column, which is unpleasant to type and easy to get wrong.
- **Match `columns` against row 1 of the header block only** — the decision as originally recorded here; reversed after a concrete counter-example (a shared row-1 label over distinct row-2 sub-labels, e.g. "Name" / "First" and "Name" / "Last") showed row-1-only can't disambiguate columns that legitimately need a multi-row reference. Superseded by the whitespace-joined-across-all-rows rule above.
- **Match `columns` against any single header row (row 1 through N), independently** — rejected: more flexible but ambiguous when two different header rows could each independently match the same or different columns; a single deterministic join-then-compare rule is simpler and unambiguous.
- **Fuzzy/case-insensitive matching** — rejected for now; whitespace normalization solves the concrete authoring friction (not knowing exactly how many spaces a joined string has), while case-sensitivity keeps matching predictable and consistent with failing fast on other typos ([ADR-0001](0001-table-option-encoding-conventions.md)).
- **Blank header cells for `header-rows=0`** — rejected in favor of numbered headers, which keep the visible column numbering aligned with what `columns=` accepts, aiding readers who want to reference a column later.
- **No header row/separator at all for `header-rows=0`** — rejected: GFM tables require a header + delimiter row to render as a table at all; synthesizing numbered headers avoids inventing a special non-table output shape.

## Consequences

- `Table.ts`'s `rowsToTable` needs to accept a header-row-count parameter (currently hardcoded to 1 row), a `<br />`-join step for display, and a separate whitespace-normalized space-join step for name matching; it currently assumes `[header, ...body] = rows`.
- Editing _any_ header row (not just row 1) can now change what a `columns=` name reference matches, since the match string spans all header rows — a wider footgun surface than the row-1-only version of this decision, worth a callout in user-facing docs.
- Two columns whose per-row header cells differ only in a blank vs. non-blank cell elsewhere, or only in internal whitespace, can end up with the same normalized match string (e.g. two "Total" columns with different but all-blank second rows); this falls under the existing "ambiguous name = first match" rule ([ADR-0001](0001-table-option-encoding-conventions.md)/[ADR-0003](0003-table-columns-option.md)), not a new failure mode.
- `header-rows` interacts with [ADR-0004](0004-table-row-window-options.md)'s row numbering: `start-row=1` always means the first row _after_ all header rows are stripped, regardless of `header-rows`'s value.

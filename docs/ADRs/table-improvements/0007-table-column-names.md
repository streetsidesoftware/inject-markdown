# ADR-0007: `column-names` option

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

`columns` ([ADR-0003](0003-table-columns-option.md)) selects, reorders, and aligns columns but doesn't rename them, and `header-format` ([ADR-0006](0006-table-header-format.md)) only applies a uniform casing transform. `column-names` lets an author override individual header labels directly — e.g. giving a friendlier label than the source file's raw header — **without** changing which columns are selected or their order. It uses the same comma-separated, quotable list syntax as `columns` ([ADR-0001](0001-table-option-encoding-conventions.md)).

## Decision

- `column-names=<label>[,<label>...]` — a comma-separated list, positional against the **output** column order (i.e. after `columns` has already selected/reordered columns, if present). Entry N sets the header label of the Nth column of the final table.
- The whole value may be double-quoted to allow literal spaces and empty positions, per [ADR-0001](0001-table-option-encoding-conventions.md): `column-names=",,Return Date,Value"` leaves the first two output columns' headers untouched and renames the third and fourth to "Return Date" and "Value".
- **An empty entry means "keep the existing header text for that column"** — it is not a way to blank out a header cell. Only non-empty entries override anything.
- **Never affects column selection or matching.** `column-names` is purely a display override on the header row; it has no bearing on which columns end up in the output (that's `columns`' job) and existing `columns=Name` references elsewhere are matched against the original source header text exactly as before ([ADR-0002](0002-table-header-rows-option.md)) — renaming a column's display label doesn't change what selects it.
- **Bypasses `header-format`.** A `column-names` label is rendered verbatim, exactly as written in the directive — it does not get upper/lower/title-cased by `header-format`. This mirrors the existing precedent of explicit overrides winning outright (e.g. `columns` alignment markers over auto-alignment, [ADR-0005](0005-table-auto-alignment.md)): an author who explicitly types a label wants exactly that text.
- **Length mismatches are tolerated, not errors.** Fewer entries than output columns: missing trailing entries behave like empty ones (original header kept). More entries than output columns: the extras are ignored. This is more forgiving than the "bad reference" error posture in [ADR-0001](0001-table-option-encoding-conventions.md), because an uneven list here is a harmless no-op rather than a reference to something that doesn't exist.
- **Works regardless of `header-rows`.** It overrides whatever the header cell would otherwise display — the source header's own text (any `header-rows` value ≥ 1) or the synthesized column-number labels when `header-rows=0`. There's no special-case interaction: a `column-names` entry simply replaces the final display text for that position.

## Options Considered

- **Positional against source column order** — rejected: once `columns` has reordered/dropped columns, renaming "by original position" would require an author to track source positions that no longer correspond to anything visible in the output; renaming what's actually in front of you (output order) is far less error-prone.
- **Empty entry blanks the header cell** — rejected: the example and stated intent ("impacts the headers... not the column selection") both read as *selective* renaming of some columns, leaving others alone; a dedicated "keep as-is" semantics for empty entries makes partial renaming (the common case) trivial to write.
- **Renamed text still passes through `header-format`** — rejected: would mean the *same* option that formats source-derived headers (`header-format`) also silently reshapes text an author deliberately typed by hand, which is a surprising and hard-to-predict outcome (e.g. an author typing `column-names=iPhone Sales` getting `Iphone Sales` back under `header-format=title`).
- **Strict length-match required** — rejected: unlike a `columns` reference (which points at something that must exist), a short/long `column-names` list has an unambiguous, harmless interpretation (some columns just aren't being renamed), so erroring would be pedantic rather than protective.

## Consequences

- Header-cell construction now has three layered inputs for a given output column: the source text (joined across `header-rows`, or synthesized under `header-rows=0`) → `header-format`'s casing transform → an optional `column-names` override that replaces the result outright. Implementation needs to apply `column-names` last, after `header-format`, and only when that position's entry is non-empty.
- Because `column-names` is positional against *output* order, inserting or removing an entry from `columns` shifts which rename applies where — an author reordering `columns` must also reorder `column-names` in step, or renames will land on the wrong column. Worth a callout in user docs as an authoring footgun, similar to the one already noted for `columns` name matching against header-row edits ([ADR-0002](0002-table-header-rows-option.md)).
- A renamed header no longer visibly matches the `columns=` reference that selected it (e.g. `columns=unit_price` + `column-names=,Unit Price` renders "Unit Price" even though the directive still says `unit_price`) — intentional, but another authoring-clarity trade-off worth documenting alongside the point above.

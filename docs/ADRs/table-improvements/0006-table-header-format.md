# ADR-0006: `header-format` option

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Source CSV/TSV files often use a machine-friendly header casing (`unit_price`, `UNIT PRICE`) that isn't what an author wants rendered in the generated Markdown table. `header-format` lets the author request a display-only casing transform, independent of the source file's actual header text.

Builds on [ADR-0002](0002-table-header-rows-option.md) (header rows, the `<br />` display join, and the whitespace-joined match string used by `columns`).

## Decision

- `header-format=none|title|upper|lower`. Default: `none` — no transformation, header cells render exactly as the source file has them (today's behavior).
- `upper`/`lower` apply a straightforward whole-string case conversion to each header cell's display text.
- `title` capitalizes the first letter of each whitespace-separated word and lowercases the rest: `"unit price"` → `"Unit Price"`, `"UNIT PRICE"` → `"Unit Price"`. Word boundaries are whitespace only — `_`/`-` are _not_ treated as separators, so `"UNIT_PRICE"` → `"Unit_price"` (only the leading letter of the whole token changes). This keeps the rule simple; authors who want nicer output for snake_case/kebab-case headers can adjust the source file instead.
- **Display only — never affects matching.** `header-format` transforms what's rendered in the output header row/cell. It has no effect on the text `columns=Name` references are matched against: that match always uses the original, unformatted source header text (per [ADR-0002](0002-table-header-rows-option.md)'s whitespace-joined match rule). This keeps the two concerns independent — an author can reformat display casing at any time without needing to update existing `columns=` references elsewhere.
- Applies to the same display text `header-rows` already produces (the `<br />`-joined multi-row header cell, if `header-rows > 1`) — each row's own text is formatted before joining, so a two-row header like "Unit" / "Price" with `header-format=upper` renders as `UNIT<br />PRICE`.
- **No special interaction with `header-rows=0`.** The synthesized numeric headers (`1`, `2`, `3`, ...) have no case to transform, so `header-format` simply has no visible effect when combined with `header-rows=0` — not treated as an error or a disallowed combination.

## Options Considered

- **Preserve existing casing, only capitalize first letters** (i.e. `"UNIT PRICE"` stays `"UNIT PRICE"` under `title`) — rejected: the chosen rule normalizes the rest of each word to lowercase first, giving a consistent result regardless of the source's original casing, which is more useful for messy/inconsistent source headers than a rule that only ever adds capitalization.
- **Underscore/hyphen as word boundaries for `title`** — rejected for v1: correctly title-casing `snake_case`/`kebab-case` tokens is a reasonable enhancement but adds rule complexity; whitespace-only is simpler and covers the common case (multi-word headers with actual spaces).
- **Formatting also changes the `columns=` match string** — rejected: would couple directive authoring to a display option (editing `header-format` could silently break existing `columns=` references), and cross-cuts [ADR-0002](0002-table-header-rows-option.md)'s matching rule for no real benefit, since authors can always type the reference in whatever casing the source actually uses.
- **Error when combined with `header-rows=0`** — rejected: it's a harmless no-op, not a misconfiguration; erroring here would be surprising given the option genuinely doesn't apply.

## Consequences

- `Table.ts`'s header-cell rendering needs a formatting step applied per header row, after `header-rows` joins rows for a column but conceptually before (or independent of) the `<br />` display join — formatting and matching must read from two different representations of the same underlying cells, so the header-cell text needs to be carried through in both forms until formatting is applied.
- Because matching is unaffected by formatting, an author who sets `header-format=upper` still writes `columns=` references against the original-cased source header — this is a deliberate simplicity/predictability trade-off (see Decision) rather than an oversight, but is worth a callout in user docs since it may not be the first thing an author expects.

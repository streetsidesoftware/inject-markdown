# ADR-0009: `markdown` option interactions with other table options

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

With `#markdown` ([ADR-0008](0008-table-markdown-cells.md)), a cell's source text and its visible text differ: `**Price**` shows as `Price`, and `` `42` `` shows as `42`. Three existing table options inspect cell text:

- `columns` name references match against the header match string ([ADR-0002](0002-table-header-rows-option.md), [ADR-0003](0003-table-columns-option.md)).
- Auto-alignment tests data-row values against a numeric/currency pattern ([ADR-0005](0005-table-auto-alignment.md)).
- `header-format` changes the case of header display text ([ADR-0006](0006-table-header-format.md)).

Each has to pick between source text and visible text once markup is present.

## Decision

1. **Cell plain text.** For a `#markdown` table, a cell's _plain text_ is the concatenation, in order, of its parsed phrasing tree's:
   - text node values
   - inline code values
   - image alt text

   Link text counts through its text children; the URL does not. Raw HTML nodes contribute nothing, except that a `<br>`/`<br />` tag and a hard break each contribute a single space. Example: `` **a**<br />`b` `` → `a b`. For a literal-text table, plain text is the cell's text, as today.

2. **`columns` name matching uses plain text.** The header match string from ADR-0002 is built from each header cell's plain text. It is still space-joined across header rows, whitespace-normalized, and case-sensitive. So `columns=Price` selects a header written `**Price**`, and toggling `#markdown` never breaks an existing `columns=` reference.

3. **Auto-alignment tests plain text.** The ADR-0005 numeric/currency pattern and its ≥90% threshold apply to each data cell's plain text. `**$5.00**` and `` `42` `` count as numeric.

4. **`header-format` transforms text nodes only.** Casing applies to the values of `text` nodes in the header cell. Link URLs, image sources and alt text, inline code, and raw HTML are left untouched. `**unit** [price](x.md)` with `header-format=upper` renders `**UNIT** [PRICE](x.md)`. With `title`, word boundaries are whitespace within and across adjacent text nodes, so `**unit** price` → `**Unit** Price`.

5. **`column-names` labels follow the same rules.** They are parsed as Markdown in a `#markdown` table (ADR-0008 point 3), still bypass `header-format` (ADR-0007), and never affect `columns` matching.

## Options Considered

- **Match `columns` against raw source text (`columns=**Price**`).** Rejected: the `*` needs encoding in the fragment, and references break whenever `#markdown` is toggled.
- **Auto-align on raw text.** Rejected: emphasis or code formatting on a number would flip the column to left-aligned.
- **`header-format` on the whole raw string.** Rejected: uppercasing a URL (`x.md` → `X.MD`) breaks links, and it would change code spans.
- **Plain text from text nodes only (no inline code or alt text).** Rejected: `` `42` `` would be empty and so never numeric, and a header written as a code span (`` `id` ``) could never be referenced by name.
- **Include raw HTML tag text in plain text.** Rejected: `columns` references would have to spell out tags such as `<sup>1</sup>`.

## Consequences

- One shared `cellPlainText` helper feeds both the header match string and auto-alignment, so the two can't drift apart.
- `title` casing across node boundaries needs care: the "first letter of a word" can sit in a later text node than the one before it, e.g. `**un**it`. The implementation should track word state across the header cell's text nodes in document order.
- An inline-code-only header (`` `id` ``) matches `columns=id`, but `header-format` doesn't change its case, so `header-format=upper` shows `` `id` `` unchanged. This is intentional (code is verbatim) and should be documented.

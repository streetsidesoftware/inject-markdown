# ADR-0001: Table option encoding conventions

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Table injection (`@@inject`/`@@inject-start`/`@@inject-table` against a `.csv`/`.tsv` source, see [Directive.ts](../../../src/FileInjector/Directive.ts) and [FileInjector.ts](../../../src/FileInjector/FileInjector.ts)) currently supports no table-shaping options: `rowsToTable` ([Table.ts](../../../src/FileInjector/Table.ts)) always treats the first row as the header and emits every column, unaligned.

We're adding four new options — `header-rows`, `columns`, `num-rows`, `start-row`, `end-row` — plus automatic alignment by content type. All existing directive options (`heading=`, `lang=`, `code`, `quote`, `L1-L10`) live in the `#`-fragment of the file reference and are parsed by `parseHashString` ([hash.ts](../../../src/util/hash.ts)) via `URLSearchParams`. Before designing each option individually, we need shared conventions so the five new options (and any future ones) read consistently.

Cross-cutting questions decided here: value syntax for lists, whether options support a bare/flag form, indexing base, and error-handling posture for bad references.

## Decision

1. **Parsing home.** The new options are additional keys recognized by `parseHashString`, alongside the existing ones — no new syntax layer.

2. **List-valued options use a single comma-separated value**, not repeated keys. `columns=Name,Age:,Price:` rather than `columns=Name&columns=Age:&columns=Price:`. This reads as a natural list and is what most authors will type first; the existing repeated-key-to-array behavior in `parseHashString` remains available for any option that's naturally a flat list of independent tokens, but isn't reused here.

3. **Literal spaces via whole-value quoting.** Column names containing spaces normally require percent/plus encoding (`First%20Name`). To make hand-authoring easier, the entire `columns` value may instead be wrapped in double quotes to permit literal, unencoded spaces: `columns="First Name,Age"`. The quotes wrap the whole list, not individual entries — a column name cannot itself contain a literal comma.

4. **1-based indexing everywhere.** Column numbers in `columns` and row numbers in `start-row`/`end-row` all start at 1. This matches `start-row`'s spec ("Numbers start with 1") and is friendlier to non-programmers editing Markdown by hand than mixing 0- and 1-based schemes across options.

5. **Only `header-rows` gets a bare/flag form.** `#header-rows` with no value means `header-rows=1`, per spec. `columns`, `num-rows`, `start-row`, `end-row` always require an explicit value when present; there's no bare form for them since a bare form would just be a redundant spelling of "omit the key" (their defaults already cover that).

6. **Bad references fail the injection.** An out-of-range column number, an unmatched column name, or (per [ADR-0003](0003-table-columns-option.md)) a non-numeric `columns` entry when `header-rows=0`, are all treated as directive errors and reported through the existing `file.error()` path (same mechanism used elsewhere in `FileInjector.ts`) rather than silently dropped or padded — consistent with failing fast on other malformed directives.

7. **Duplicates are permitted, ambiguity resolves to first match.** Referencing the same column twice in `columns` duplicates it in the output. If a column name matches more than one header (duplicate header text in the source file), the first matching column wins; this is not treated as an error.

## Options Considered

Alternatives considered and rejected for each point are recorded inline in the Decision items above (e.g. repeated-key lists, percent-encoding-only for spaces, 0-based indexing, silent-skip on bad references) — see the interview history in this ADR's commit log for the reasoning trail.

## Consequences

- Every subsequent table-option ADR (0002–0005) builds on these conventions instead of re-deciding them.
- Column names containing a literal comma are unsupported (no escape mechanism defined). If this turns out to matter in practice, it needs a follow-up ADR.
- Because bad references are hard errors, a source CSV/TSV whose headers change (e.g. a column gets renamed upstream) will break existing `columns=` directives loudly at injection time rather than degrading quietly — this is intentional (catches drift) but worth calling out as an authoring/maintenance cost.

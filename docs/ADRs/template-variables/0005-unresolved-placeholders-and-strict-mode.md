# ADR-0005: Unresolved placeholders and strict mode

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

The feature request specifies that unresolved placeholders remain untouched in the output with only a warning by default, with an optional strict mode for when that's not acceptable. This needs to pin down exactly what counts as "unresolved" (including a placeholder that resolves to a non-scalar JSON value — an object or array), how many warnings a repeated unresolved name produces, and what strict mode actually does differently.

## Decision

1. **Default (no strict mode).** A placeholder is unresolved if no value source ([ADR-0004](0004-value-source-precedence.md)) defines its name, _or_ the name resolves to a non-scalar value (a JSON object or array, from a `values-file=`/`--values-file`). An unresolved placeholder is left in the output exactly as written, and produces exactly one warning per unique unresolved name per directive (not one per occurrence), reported via a non-fatal `file.message()` — the same mechanism `FileInjector.ts` already uses for non-fatal messages elsewhere (e.g. `readAndParseMarkdownFile`'s failed-read path).
2. **`--strict-vars`.** When set, an unresolved placeholder (same definition as above) becomes a directive error via `file.error()`, following the same pattern as the table feature's bad-reference errors ([table-improvements ADR-0001](../table-improvements/0001-table-option-encoding-conventions.md) point 6) — and respects `--stop-on-errors`/`--write-on-error` exactly like any other injection error.
3. **Non-scalar values are always unresolved**, in both modes — never JSON-stringified into the output. Keeps this a value-injection feature, not a templating one.

## Options Considered

- **JSON-stringify non-scalar values** into the output — rejected: starts to look like general templating, which the feature request explicitly scopes out (the goal is simple value injection, not a full-fledged template engine).
- **Hard error on a non-scalar reference even outside strict mode** — rejected: inconsistent with the request's explicit default of "unresolved placeholders remain untouched with only a warning"; strict mode is the intended opt-in for turning any of this into a hard failure.
- **One warning per occurrence** instead of per unique name — rejected: for a placeholder repeated several times in one injected block (e.g. a version string used across multiple `npm install` lines), per-occurrence warnings would dominate the output without adding information beyond "this name is unresolved."
- **`--strict-vars` aborts the whole run immediately** instead of erroring just that file — rejected: inconsistent with how every other injection error (bad file reference, bad `columns` reference) is handled today — collected and reported per file, not an immediate hard stop mid-run.

## Consequences

- Warning/error messages need to include the directive's position (via `file.message(...)`/`file.error(...)`, same as existing messages) and the unresolved name, so an author can locate the placeholder.
- `app.mts` gains `--strict-vars`, mirrored into `FileInjectorOptions`/`Options` per the standard convention.
- New glossary terms: **Unresolved placeholder**, **`--strict-vars`**.

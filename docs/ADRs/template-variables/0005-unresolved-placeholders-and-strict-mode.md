# ADR-0005: Unresolved placeholders and strict mode

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

The feature request specifies that unresolved placeholders remain untouched in the output with only a warning by default, with an optional strict mode for when that's not acceptable. This needs to pin down exactly what counts as "unresolved" (including a placeholder that resolves to a non-scalar JSON value — an object or array), how many warnings a repeated unresolved name produces, and what strict mode actually does differently.

## Decision

1. **Default (no strict mode).** A placeholder is unresolved if _no layer_ ([ADR-0008](0008-value-layering-and-resolution.md)) holds its name as a scalar. A layer holding a non-scalar (object or array) or `null` at the name does not resolve it and does not stop the search — resolution continues to the next layer, and only the exhaustion of all layers makes the placeholder unresolved. An unresolved placeholder is left in the output exactly as written, and produces exactly one warning per unique unresolved name per directive (not one per occurrence), reported via a non-fatal `file.message()` — the same mechanism `FileInjector.ts` already uses for non-fatal messages elsewhere (e.g. `readAndParseMarkdownFile`'s failed-read path).
2. **`--strict-vars`.** When set, an unresolved placeholder (same definition as above) becomes a directive error via `file.error()`, following the same pattern as the table feature's bad-reference errors ([table-improvements ADR-0001](../table-improvements/0001-table-option-encoding-conventions.md) point 6) — and respects `--stop-on-errors`/`--write-on-error` exactly like any other injection error.
3. **Non-scalar values are never substituted**, in both modes — never JSON-stringified into the output. Keeps this a value-injection feature, not a templating one. A non-scalar is not itself "the answer" though: it is skipped, and a lower-precedence layer may still resolve the name (point 1).
4. **Two distinct messages.** "Unresolved" covers two different authoring mistakes, and the warning says which:
   - no layer mentions the name at all — typically a typo or a missing value source;
   - one or more layers hold the name, but every one of them holds an object, an array or `null` — typically a name pointing at a branch instead of a leaf (`{@ package.engines @}` where `{@ package.engines.node @}` was meant).

   The second wording names the offending kind (object/array/null) so the author can tell "I misspelled this" from "I stopped one segment short". `--strict-vars` turns either into a directive error, with the same distinction preserved in the error text.

## Options Considered

- **JSON-stringify non-scalar values** into the output — rejected: starts to look like general templating, which the feature request explicitly scopes out (the goal is simple value injection, not a full-fledged template engine).
- **Treating a non-scalar or `null` hit as final** (the name is "defined", so stop and report unresolved) — rejected: an intermediate object is often created implicitly, not written by anyone. `--value pkg.a=1` produces an object at `pkg` as a side effect of the dotted name, which would then mask a scalar `pkg` in a values file the author did explicitly write. Skipping non-scalars keeps the outcome dependent on what sources actually define rather than on how a name happened to be spelled. See [ADR-0008](0008-value-layering-and-resolution.md) point 3.
- **Rendering `null` as an empty string** — rejected: it turns the most likely cause (a placeholder naming something the data doesn't really carry) into silently empty output, exactly where the default warn-and-leave-untouched behavior would otherwise flag it.
- **One generic "unresolved" message** for both cases — rejected: the fixes are different (correct the name vs. add a value source), and distinguishing them costs one branch at the call site.
- **Hard error on a non-scalar reference even outside strict mode** — rejected: inconsistent with the request's explicit default of "unresolved placeholders remain untouched with only a warning"; strict mode is the intended opt-in for turning any of this into a hard failure.
- **One warning per occurrence** instead of per unique name — rejected: for a placeholder repeated several times in one injected block (e.g. a version string used across multiple `npm install` lines), per-occurrence warnings would dominate the output without adding information beyond "this name is unresolved."
- **`--strict-vars` aborts the whole run immediately** instead of erroring just that file — rejected: inconsistent with how every other injection error (bad file reference, bad `columns` reference) is handled today — collected and reported per file, not an immediate hard stop mid-run.

## Consequences

- Warning/error messages need to include the directive's position (via `file.message(...)`/`file.error(...)`, same as existing messages) and the unresolved name, so an author can locate the placeholder. Resolution has to report _why_ a name failed — never defined, versus defined only as a non-scalar/`null` — so the resolver returns that distinction rather than a bare `undefined`.
- `app.mts` gains `--strict-vars`, mirrored into `FileInjectorOptions`/`Options` per the standard convention.
- New glossary terms: **Unresolved placeholder**, **`--strict-vars`**. The **Unresolved placeholder** entry needs updating for the layer-exhaustion definition and the `null` rule.

# ADR-0011: JSON files as a table source

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Table injection reads only delimited text. `readAndParseTableFile` ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)) always calls `parseDelimitedText` with the delimiter from `delimiterForExtension` ([csv.ts](../../../src/util/csv.ts)), which is `,` for anything that isn't `.tsv`. So `@@inject-table: data.json` runs a JSON file through the CSV parser and produces nonsense.

A `.json` file referenced by `@@inject:` is injected as a code block. The README's `sample.json` example relies on that, and only `.csv`/`.tsv` default to a table (`tableFileExtensions` in [Directive.ts](../../../src/FileInjector/Directive.ts)).

Much tabular data (API exports, generated reports, config lists) is JSON, typically an array of records. Everything after parsing (`rowsToTable`, `rowsToHtmlTable`, `#markdown` per [ADR-0008](0008-table-markdown-cells.md), `#html-table` per [ADR-0010](0010-table-html-table.md), placeholder substitution) works on `string[][]` rows. So supporting JSON comes down to turning a JSON value into those rows.

## Decision

1. **Opt-in through `@@inject-table:` only.** `@@inject-table: data.json` parses the file as JSON. `@@inject: data.json` keeps injecting a code block, as it does today; `.json` is not added to `tableFileExtensions`.

2. **Detected by the `.json` extension.** Under `@@inject-table:`, a file whose path ends in `.json` (case-insensitive, local or remote) is parsed with strict `JSON.parse`, the same parser `values-file=` uses ([values.ts](../../../src/util/values.ts)). Every other extension keeps the delimited-text path. `.jsonc` and JSON with comments are not supported.

3. **Shape: a top-level array of objects.** Each element is one data row. Example:

   ```json
   [
     { "name": "Ada", "born": 1815 },
     { "name": "Grace", "role": "Admiral" }
   ]
   ```

   renders as a table with the columns `name`, `born`, `role`.

4. **Columns are the union of keys, in first-seen order.** Keys are collected across all elements in the order they first appear. A key an element doesn't have becomes an empty cell, so no data is silently dropped. The keys form the header row.

5. **Cell values.**
   - A string is used as-is.
   - A number or boolean uses `String(value)`, so JSON `1.50` renders as `1.5` and `1e3` as `1000`. An author who needs the source formatting stores the value as a string (`"1.50"`).
   - `null` and a missing key are both an empty cell.
   - A nested object or array becomes its compact JSON text (`JSON.stringify`), e.g. `{"x":1}`.

6. **Bad input is a directive error.** Each of these is reported through `file.error()`, like other malformed directives ([ADR-0001](0001-table-option-encoding-conventions.md) point 6), and the message names what was found:
   - invalid JSON
   - a top-level value that isn't an array (including a wrapped `{"items":[...]}`)
   - an element that isn't an object (`[{"a":1}, 2]`, or an array of arrays)
   - an empty array `[]`, because a table with no columns can't be rendered

7. **`#L1-L10` is a directive error on a JSON source.** Slicing lines out of JSON almost always makes it invalid. The row window options ([ADR-0004](0004-table-row-window-options.md)) are the way to limit rows.

8. **Placeholders are substituted per cell, keys included.** Substitution runs on the cell text after the JSON is parsed and converted to rows. That covers string values, nested values' JSON text, and the header row of keys. It is the JSON analog of substituting parsed CSV fields ([template-variables/ADR-0006](../template-variables/0006-substitution-mechanics-and-timing.md)), so a substituted `"` or `\` can never corrupt the JSON. Columns are collected before substitution, so two keys that substitute to the same text stay two columns.

9. **`header-rows` with JSON.** The keys form exactly one header row, so the default (`header-rows=1`) matches. `header-rows=0` drops the key header: the pipe form synthesizes numbered headers ([ADR-0002](0002-table-header-rows-option.md)), and `#html-table` emits no `<thead>` ([ADR-0010](0010-table-html-table.md)). `header-rows=N` with `N > 1` is a directive error, because there is only one row of keys.

10. **Everything downstream is unchanged.** The rows feed the same table builders. `#markdown`, `#html-table`, `columns` name matching (against the key header) and the other table options behave as they do for CSV.

## Options Considered

- **`.json` defaults to a table, like `.csv`/`.tsv`.** Rejected: a breaking change for every existing `@@inject: something.json` code-block injection, including the README's own example.
- **A hash flag such as `#table`.** Rejected: ADR-0008 already ruled a `#table` flag out of scope; `@@inject-table:` is the existing way to force a table.
- **Also accept an array of arrays (first row as the header, like CSV).** Rejected for now to keep the accepted shape to one form. It's a directive error, and can be added later without breaking anything.
- **Also accept an object of objects, with the outer keys as a first column.** Rejected: that column needs a name, which means another option.
- **Only the first object's keys as columns.** Rejected: silently drops data in later rows.
- **Nested values as a directive error.** Rejected: compact JSON text keeps the data visible without failing the build.
- **Flatten nested keys into dotted columns (`a.b`).** Rejected: richer, but arrays inside objects would still need their own rule.
- **A `path=` option to select a nested array.** Deferred: a top-level array covers the common case, and a wrapped array's error names what was found. A path option can be added later without breaking anything.
- **Empty array as empty output.** Rejected in favor of a consistent error: an empty table has no columns to render.
- **Skip non-object elements with a warning.** Rejected: silently loses rows.
- **`.jsonc` with comments and trailing commas.** Rejected: needs a new parser dependency for an uncommon case.
- **Apply `#L1-L10` before parsing, or ignore it.** Rejected: the first rarely yields valid JSON, and the second hides a mistake.
- **Substitute placeholders in the raw text before parsing.** Rejected: a substituted `"` or `\` corrupts the JSON.
- **String values only, keys literal.** Rejected: CSV substitutes header cells too, so this would be inconsistent.
- **`header-rows` not allowed with JSON, or ignored.** Rejected: `header-rows=0` is a meaningful request (hide the key header), and silently ignoring `N > 1` hides a mistake.
- **Preserve numbers' source text.** Rejected: needs a custom or position-tracking JSON parser. Storing the value as a string covers the need.

## Consequences

- `readAndParseTableFile` branches on the extension before `parseDelimitedText`. A new `jsonToRows(value): string[][]` returns the key header followed by the data rows, so the substitution loop and table builders need no changes.
- The `#L1-L10` check has to happen before `extractLines` runs, which slices every source today.
- The `header-rows` rules in point 9 take effect only once ADR-0002 is implemented. Until then the key header is always emitted.
- JSON files are parsed whole, as `values-file=` already does. A remote source is bounded by the 10 MB response cap ([security-hardening/ADR-0003](../security-hardening/0003-remote-reference-guardrails.md)); a local file has no size limit, the same as any other local injection.
- The README needs a JSON example and should say explicitly that `@@inject:` on a `.json` file still gives a code block.

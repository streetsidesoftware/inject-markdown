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

   renders as a table with the columns `name`, `born`, `role` (see point 4 for which elements contribute).

4. **Columns come from the objects in the row window.** The columns are the union of keys of the elements inside the row window (`start-row`, `end-row`, `num-rows`, [ADR-0004](0004-table-row-window-options.md)), in the order they first appear. Each array element is one data row, numbered from 1 as ADR-0004 defines. Without window options, the window is every element. A key present in the window with a `null` value still counts as a column. An element in the window that lacks a key gets an empty cell. The keys form the header row.

   A key that appears only outside the window is not a column. So `columns=role` (ADR-0003) against a window whose objects have no `role` key is an unmatched name, which is a directive error ([ADR-0001](0001-table-option-encoding-conventions.md) point 6). Example: with `start-row=2&end-row=2` on the array in point 3, the columns are `name`, `role`.

   If the window selects no elements (e.g. `start-row=100` on 20 elements), the header falls back to the union of keys across the whole file and the table has no data rows. That matches ADR-0004's header-only result for an out-of-range window, which is not an error.

5. **Cell values.**
   - A string is used as-is.
   - A number or boolean uses `String(value)`, so JSON `1.50` renders as `1.5` and `1e3` as `1000`. An author who needs the source formatting stores the value as a string (`"1.50"`).
   - `null` and a missing key are both an empty cell.
   - A nested object or array depends on the table form:
     - `#html-table` ([ADR-0010](0010-table-html-table.md)): a fenced code block tagged `json`, pretty-printed with 2-space indentation (`JSON.stringify(value, null, 2)`). The cell counts as having markup, so it is blank-line wrapped.
     - Pipe form with `#markdown` ([ADR-0008](0008-table-markdown-cells.md)): an inline code span of the compact JSON, e.g. `` `{"x":1}` ``.
     - Plain pipe form: the compact JSON as literal text, e.g. `{"x":1}`.

6. **Bad input is a directive error.** Each of these is reported through `file.error()`, like other malformed directives ([ADR-0001](0001-table-option-encoding-conventions.md) point 6), and the message names what was found:
   - invalid JSON
   - a top-level value that isn't an array (including a wrapped `{"items":[...]}`)
   - an element that isn't an object (`[{"a":1}, 2]`, or an array of arrays)
   - an empty array `[]`, because a table with no columns can't be rendered

7. **`#L1-L10` is a directive error on a JSON source.** Slicing lines out of JSON almost always makes it invalid. The row window options ([ADR-0004](0004-table-row-window-options.md)) are the way to limit rows.

8. **Placeholders are substituted after parsing, keys included.** Substitution never touches the raw JSON text, so a substituted `"` or `\` can never corrupt it. It is the JSON analog of substituting parsed CSV fields ([template-variables/ADR-0006](../template-variables/0006-substitution-mechanics-and-timing.md)):
   - Top-level string values and the header row of keys are substituted per cell.
   - Inside a nested object or array, each string leaf is substituted before the value is serialized (point 5), in every table form. Keys inside nested objects stay literal.
   - Columns are collected before substitution, so two keys that substitute to the same text stay two columns.

9. **`header-rows` with JSON.** The keys form exactly one header row, so the default (`header-rows=1`) matches. `header-rows=0` drops the key header: the pipe form synthesizes numbered headers ([ADR-0002](0002-table-header-rows-option.md)), and `#html-table` emits no `<thead>` ([ADR-0010](0010-table-html-table.md)). `header-rows=N` with `N > 1` is a directive error, because there is only one row of keys.

10. **Otherwise the same as CSV.** `#markdown`, `#html-table`, `columns` name matching (against the key header) and the other table options behave as they do for CSV, apart from the nested-value rendering in point 5.

## Options Considered

- **`.json` defaults to a table, like `.csv`/`.tsv`.** Rejected: a breaking change for every existing `@@inject: something.json` code-block injection, including the README's own example.
- **A hash flag such as `#table`.** Rejected: ADR-0008 already ruled a `#table` flag out of scope; `@@inject-table:` is the existing way to force a table.
- **Also accept an array of arrays (first row as the header, like CSV).** Rejected for now to keep the accepted shape to one form. It's a directive error, and can be added later without breaking anything.
- **Also accept an object of objects, with the outer keys as a first column.** Rejected: that column needs a name, which means another option.
- **Union of keys across the whole file.** The original decision here, revised so a windowed table doesn't carry columns that are empty for every row shown. Keys outside the window aren't in the table at all, so there is nothing to render for them.
- **Empty window as empty output or a directive error.** Rejected: ADR-0004 deliberately treats an out-of-range window as a header-only table, not an error. Falling back to all keys for the header keeps JSON consistent with that.
- **Only the first object's keys as columns.** Rejected: silently drops data in later rows.
- **Nested values as a directive error.** Rejected: rendering them keeps the data visible without failing the build.
- **Nested values as compact JSON text in every form.** The original decision here. Revised because `#html-table` cells can hold a code block, which is far more readable, and a code span marks the value as code in a `#markdown` pipe table.
- **Compact JSON in the `#html-table` code block.** Rejected: long values are hard to read on one line.
- **Code blocks for nested objects only, with arrays as text.** Rejected: one rule for every non-scalar is simpler.
- **Nested values verbatim, with no placeholder substitution.** Rejected: string leaves are data like any other string value, and substituting them before serializing is safe.
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

- `readAndParseTableFile` branches on the extension before `parseDelimitedText`. A JSON source can't be flattened to `string[][]` up front: nested values keep their value until the table form is known (point 5), and their string leaves are substituted separately (point 8). The row model needs a cell kind for "nested JSON value" alongside text, and the three table builders each render it.
- Column collection depends on the row window (point 4). Until ADR-0004 is implemented, the window is every element.
- The `#L1-L10` check has to happen before `extractLines` runs, which slices every source today.
- The `header-rows` rules in point 9 take effect only once ADR-0002 is implemented. Until then the key header is always emitted.
- JSON files are parsed whole, as `values-file=` already does. A remote source is bounded by the 10 MB response cap ([security-hardening/ADR-0003](../security-hardening/0003-remote-reference-guardrails.md)); a local file has no size limit, the same as any other local injection.
- The README needs a JSON example and should say explicitly that `@@inject:` on a `.json` file still gives a code block.

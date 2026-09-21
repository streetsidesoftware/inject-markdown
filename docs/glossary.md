# Glossary

Terms used across [docs/ADRs](ADRs/) and the table-injection feature. Keep this in sync as new decisions introduce or refine terminology.

**Directive**
An HTML-comment instruction in a Markdown file (`<!--- @@inject: file --->` and variants) that tells `inject-markdown` to pull content from another file. See [Directive.ts](../src/FileInjector/Directive.ts).

**Table injection**
A directive whose source file resolves to a `.csv`/`.tsv` file (or is explicitly `@@inject-table`), rendered as a GFM Markdown table instead of Markdown content or a code block. See [FileInjector.ts](../src/FileInjector/FileInjector.ts).

**Hash/fragment options**
Directive options encoded in the `#` fragment of the file reference (e.g. `file.csv#header-rows&columns=Name,Age:`), parsed by `parseHashString`. See [hash.ts](../src/util/hash.ts) and [ADR-0001](ADRs/table-improvements/0001-table-option-encoding-conventions.md).

**Bare/flag option**
An option written without `=value` (e.g. `#header-rows`), which takes on a documented default rather than requiring an explicit value. Currently only `header-rows` supports this form.

**Header row(s)**
The leading N rows of a table's parsed source data (N = `header-rows`, default 1) that are excluded from the data body and rendered as the table's header. See [ADR-0002](ADRs/table-improvements/0002-table-header-rows-option.md).

**Data row**
Any parsed source row that is not a header row. Row numbering for `start-row`/`end-row` starts at 1 from the first data row, independent of how many header rows precede it. See [ADR-0004](ADRs/table-improvements/0004-table-row-window-options.md).

**Row window**
The range of data rows actually injected, determined by `start-row`, `end-row`, and `num-rows` together. See [ADR-0004](ADRs/table-improvements/0004-table-row-window-options.md).

**Column reference**
An entry in the `columns` option identifying one source column, either by 1-based number or by name (matched against the column's header match string, see below), optionally carrying an alignment marker. See [ADR-0003](ADRs/table-improvements/0003-table-columns-option.md).

**Header match string**
The text a `columns` name reference is compared against: a column's non-empty header-row cells joined with a single space (not `<br />`) and whitespace-normalized, distinct from the `<br />`-joined text actually displayed in the output header. Unaffected by `header-format`. See [ADR-0002](ADRs/table-improvements/0002-table-header-rows-option.md).

**Alignment marker**
A leading and/or trailing colon on a column reference (`:Name`, `Name:`, `:Name:`) requesting left/right/center alignment for that column, mirroring GFM's own `:---`/`---:`/`:---:` table delimiter-row syntax.

**Auto-alignment**
Automatic right-alignment applied to a column with no explicit alignment marker, when enough of its data-row values look numeric or currency-like. See [ADR-0005](ADRs/table-improvements/0005-table-auto-alignment.md).

**Explicit alignment**
Alignment set directly via a `columns` alignment marker; always takes precedence over auto-alignment for that column.

**Header format**
A display-only casing transform (`none`/`title`/`upper`/`lower`) applied to rendered header-cell text via `header-format`. Never affects the header match string used by `columns` name references. See [ADR-0006](ADRs/table-improvements/0006-table-header-format.md).

**`column-names`**
A comma-separated list, positional against the output column order, that overrides individual header labels verbatim (bypassing `header-format`). An empty entry keeps that column's existing header; it never affects column selection or `columns` name matching. See [ADR-0007](ADRs/table-improvements/0007-table-column-names.md).

**Injection root**
The directory (default: `cwd`) that every local (`file:`) `@@inject`-family directive's resolved, realpath'd target must stay inside; a reference resolving outside it is a fatal error. Applies only to local file reads, not remote `http(s)` fetches. See [ADR-0001](ADRs/file-access-security/0001-injection-root-boundary.md).

**`--allow-outside-root`**
A repeatable CLI option (and matching `FileInjectorOptions.allowOutsideRoot`) naming specific extra directories a directive may resolve into, on top of the injection root. See [ADR-0002](ADRs/file-access-security/0002-injection-root-escape-hatch.md).

**Placeholder**
A `{@ name @}` marker inside injected content, replaced with a value resolved against sources the *directive* (not the injected file) supplies. Whitespace inside the delimiters is optional and trimmed; a leading backslash (`\{@ ... @}`) escapes it to literal text. Not a full template engine — no conditionals or loops. See [ADR-0001](ADRs/template-variables/0001-placeholder-syntax.md).

**Placeholder name**
The dotted path inside a placeholder (e.g. `package.version`), each segment `[A-Za-z0-9_-]+`. A dotted name traverses into nested objects from a JSON value source. See [ADR-0001](ADRs/template-variables/0001-placeholder-syntax.md).

**`values=` option**
A directive hash option supplying inline placeholder values as comma-separated `name:value` pairs (`values=name:val,name2:val2`), with whole-value quoting for literal commas/colons. Highest-precedence value source for its directive. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md).

**`values-file=` option**
A directive hash option naming a JSON file of placeholder values, resolved relative to the containing document and subject to the injection-root boundary like any directive file reference. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md).

**`vars` flag**
A bare directive hash flag (`#vars`) that opts a directive into placeholder scanning against CLI/environment value sources alone, when it defines no `values=`/`values-file=` of its own. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md).

**`--value`**
A repeatable CLI option (`--value name=val`) setting a run-wide placeholder value, available to any directive that opts into scanning. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**`--values-file`**
A CLI option naming a JSON file of run-wide placeholder values, resolved relative to `--cwd`. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**`--allow-env`**
A repeatable CLI option naming environment variable names a directive may reference via the `env.` placeholder namespace, mirroring `--allow-outside-root`'s allowlist pattern. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**`env.` namespace**
A reserved placeholder-name prefix (`{@ env.VERSION @}`) resolving to `process.env.VERSION` when allow-listed via `--allow-env`; always reserved, even if another value source defines a top-level `env` key. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**Value source precedence**
The fixed lookup order for resolving a placeholder name when more than one source defines it: directive `values=` > directive `values-file=` > CLI `--value` > CLI `--values-file` > environment (`env.` namespace only). The first source defining a name wins; sources are not deep-merged. See [ADR-0004](ADRs/template-variables/0004-value-source-precedence.md).

**Unresolved placeholder**
A placeholder whose name no value source defines, or that resolves to a non-scalar (object/array) value. Left untouched in the output with one warning per unique name per directive by default; becomes a directive error under `--strict-vars`. See [ADR-0005](ADRs/template-variables/0005-unresolved-placeholders-and-strict-mode.md).

**`--strict-vars`**
A CLI flag making an unresolved placeholder a directive error (via `file.error()`, respecting `--stop-on-errors`/`--write-on-error`) instead of the default warn-and-leave-untouched behavior. See [ADR-0005](ADRs/template-variables/0005-unresolved-placeholders-and-strict-mode.md).

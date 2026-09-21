# Glossary

Terms used across [docs/ADRs](ADRs/) and the table-injection feature. Keep this in sync as new decisions introduce or refine terminology.

**Directive**
An HTML-comment instruction in a Markdown file (`<!--- @@inject: file --->` and variants) that tells `inject-markdown` to pull content from another file. See [Directive.ts](../src/FileInjector/Directive.ts).

**Table injection**
A directive whose source file resolves to a `.csv`/`.tsv` file (or is explicitly `@@inject-table`), rendered as a GFM Markdown table instead of Markdown content or a code block. See [FileInjector.ts](../src/FileInjector/FileInjector.ts).

**Hash/fragment options**
Directive options encoded in the `#` fragment of the file reference (e.g. `file.csv#header-rows&columns=Name,Age:`), parsed by `parseHashString`. See [hash.ts](../src/util/hash.ts) and [ADR-0001](ADRs/0001-table-option-encoding-conventions.md).

**Bare/flag option**
An option written without `=value` (e.g. `#header-rows`), which takes on a documented default rather than requiring an explicit value. Currently only `header-rows` supports this form.

**Header row(s)**
The leading N rows of a table's parsed source data (N = `header-rows`, default 1) that are excluded from the data body and rendered as the table's header. See [ADR-0002](ADRs/0002-table-header-rows-option.md).

**Data row**
Any parsed source row that is not a header row. Row numbering for `start-row`/`end-row` starts at 1 from the first data row, independent of how many header rows precede it. See [ADR-0004](ADRs/0004-table-row-window-options.md).

**Row window**
The range of data rows actually injected, determined by `start-row`, `end-row`, and `num-rows` together. See [ADR-0004](ADRs/0004-table-row-window-options.md).

**Column reference**
An entry in the `columns` option identifying one source column, either by 1-based number or by name (matched against the column's header match string, see below), optionally carrying an alignment marker. See [ADR-0003](ADRs/0003-table-columns-option.md).

**Header match string**
The text a `columns` name reference is compared against: a column's non-empty header-row cells joined with a single space (not `<br />`) and whitespace-normalized, distinct from the `<br />`-joined text actually displayed in the output header. Unaffected by `header-format`. See [ADR-0002](ADRs/0002-table-header-rows-option.md).

**Alignment marker**
A leading and/or trailing colon on a column reference (`:Name`, `Name:`, `:Name:`) requesting left/right/center alignment for that column, mirroring GFM's own `:---`/`---:`/`:---:` table delimiter-row syntax.

**Auto-alignment**
Automatic right-alignment applied to a column with no explicit alignment marker, when enough of its data-row values look numeric or currency-like. See [ADR-0005](ADRs/0005-table-auto-alignment.md).

**Explicit alignment**
Alignment set directly via a `columns` alignment marker; always takes precedence over auto-alignment for that column.

**Header format**
A display-only casing transform (`none`/`title`/`upper`/`lower`) applied to rendered header-cell text via `header-format`. Never affects the header match string used by `columns` name references. See [ADR-0006](ADRs/0006-table-header-format.md).

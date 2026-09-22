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
A `{@ name @}` marker inside injected content, replaced with a value resolved against sources the _directive_ (not the injected file) supplies. Whitespace inside the delimiters is optional and trimmed; a leading backslash (`\{@ ... @}`) escapes it to literal text. Not a full template engine — no conditionals or loops. See [ADR-0001](ADRs/template-variables/0001-placeholder-syntax.md).

**Placeholder name**
The dotted path inside a placeholder (e.g. `package.version`), each segment `[A-Za-z0-9_-]+`. A dotted name traverses into nested objects from a JSON value source. See [ADR-0001](ADRs/template-variables/0001-placeholder-syntax.md).

**`values=` option**
A directive hash option supplying inline placeholder values as comma-separated `name:value` pairs (`values=name:val,name2:val2`), with whole-value quoting for literal commas/colons. Highest-precedence value source for its directive. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md).

**`values-file=` option**
A directive hash option naming one or more JSON files of placeholder values (`values-file=[prefix:]path[,...]`), each resolved relative to the containing document and subject to the injection-root boundary like any directive file reference. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md), [ADR-0007](ADRs/template-variables/0007-values-file-prefixing.md).

**`vars` flag**
A bare directive hash flag (`#vars`) that opts a directive into placeholder scanning against CLI/environment value sources alone, when it defines no `values=`/`values-file=` of its own. See [ADR-0002](ADRs/template-variables/0002-directive-value-sources.md).

**`--value`**
A repeatable CLI option (`--value name=val`) setting a run-wide placeholder value, available to any directive that opts into scanning. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**`--values-file`**
A repeatable CLI option naming a JSON file of run-wide placeholder values, resolved relative to `--cwd`; each occurrence takes the same `[prefix:]path` grammar as the directive-level `values-file=` option. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md), [ADR-0007](ADRs/template-variables/0007-values-file-prefixing.md).

**`--allow-env`**
A repeatable CLI option naming environment variable names a directive may reference via the `env.` placeholder namespace, mirroring `--allow-outside-root`'s allowlist pattern. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**`env.` namespace**
A reserved placeholder-name prefix (`{@ env.VERSION @}`) resolving to `process.env.VERSION` when allow-listed via `--allow-env`; always reserved, even if another value source defines a top-level `env` key. See [ADR-0003](ADRs/template-variables/0003-cli-and-env-value-sources.md).

**Value source precedence**
The fixed lookup order for resolving a placeholder name when more than one source _type_ defines it: directive `values=` > directive `values-file=` > CLI `--value` > CLI `--values-file` > environment (`env.` namespace only). It ranks source types; what "wins" means for a partial collision is [per-leaf resolution](#per-leaf-resolution). See [ADR-0004](ADRs/template-variables/0004-value-source-precedence.md), [ADR-0008](ADRs/template-variables/0008-value-layering-and-resolution.md).

**Value layer**
The smallest unit supplying placeholder values: one `name:value` pair from a directive's `values=`, one `--value` flag, or one `values-file=`/`--values-file` entry. Layers are ordered by [value source precedence](#value-source-precedence), with a later-listed entry sitting above an earlier one within the same source. Layers are never combined into a shared value tree. See [ADR-0008](ADRs/template-variables/0008-value-layering-and-resolution.md).

**Per-leaf resolution**
Resolving a placeholder name by walking [value layers](#value-layer) in order and taking the first that holds that exact name as a scalar. A layer lacking the name, or holding an object, array or `null` at it, is skipped rather than ending the search — so `--value package.engines.node=26.0` overrides one leaf of a values file without hiding its siblings. Nothing is deep-merged; "merge" describes only the observable result. See [ADR-0008](ADRs/template-variables/0008-value-layering-and-resolution.md).

**Unresolved placeholder**
A placeholder no [value layer](#value-layer) holds as a scalar — either nothing defines the name, or every layer that has it holds an object, array or `null` there. The warning distinguishes the two. Left untouched in the output with one warning per unique name per directive by default; becomes a directive error under `--strict-vars`. See [ADR-0005](ADRs/template-variables/0005-unresolved-placeholders-and-strict-mode.md), [ADR-0008](ADRs/template-variables/0008-value-layering-and-resolution.md).

**`--strict-vars`**
A CLI flag making an unresolved placeholder a directive error (via `file.error()`, respecting `--stop-on-errors`/`--write-on-error`) instead of the default warn-and-leave-untouched behavior. See [ADR-0005](ADRs/template-variables/0005-unresolved-placeholders-and-strict-mode.md).

**Values-file prefix**
The namespace a `values-file=`/`--values-file` entry's keys are placed under, addressed via a dotted [placeholder name](#placeholder-name) (e.g. `{@ package.version @}`). Auto-derived from the file's basename by default, settable explicitly (`prefix:path`), or opted out of via [root merge](#root-merge-path) (`:path`). See [ADR-0007](ADRs/template-variables/0007-values-file-prefixing.md).

**Auto-derived prefix**
The default values-file prefix, computed by stripping a leading Windows drive (`c:package.json` → `package`) and the extension from a `values-file=`/`--values-file` entry's basename. Always a single segment: a directive error if the result isn't a valid placeholder-name segment (`[A-Za-z0-9_-]+`) — no automatic sanitizing, and no nesting on a dotted filename. See [ADR-0007](ADRs/template-variables/0007-values-file-prefixing.md), [ADR-0009](ADRs/template-variables/0009-prefix-grammar-and-drive-letters.md).

**Explicit prefix**
The namespace written before the colon in a `values-file=`/`--values-file` entry (`pkg:package.json`). Matches `[A-Za-z0-9._-]{2,}` — two characters or more, so a Windows drive letter is never parsed as one — and may be dotted, in which case it nests (`pkg.build:data.json` → `{@ pkg.build.* @}`). See [ADR-0009](ADRs/template-variables/0009-prefix-grammar-and-drive-letters.md).

**Root merge (`:path`)**
A `values-file=`/`--values-file` entry written with an empty prefix (a leading colon, no name before it), contributing that file's keys directly to the root namespace instead of under an auto-derived or explicit prefix — the opt-out for a directive that wants bare placeholder names from a single file. It is an ordinary [value layer](#value-layer) with no prefix, so two root-merged entries resolve per leaf rather than the later one replacing the earlier. See [ADR-0007](ADRs/template-variables/0007-values-file-prefixing.md), [ADR-0008](ADRs/template-variables/0008-value-layering-and-resolution.md).

**Value alias**
A mapping from one [placeholder name](#placeholder-name) to another, declared with the `value-alias=` directive option or the `--value-alias` CLI option. It holds no value of its own: resolving the aliased name resolves the target through the normal layer walk, so it always reflects what the sources currently say. Ranks above the values of its own tier, so a directive alias redefines a name that directive's own `values-file=` supplies. See [ADR-0010](ADRs/template-variables/0010-value-alias.md).

**`value-alias=` option**
A directive hash option declaring aliases as comma-separated `new:target` pairs (`value-alias=version:release.latest.version`). Opts the directive into placeholder scanning, like `values=`/`values-file=`/`vars`. See [ADR-0010](ADRs/template-variables/0010-value-alias.md).

**`--value-alias`**
A repeatable CLI option (`--value-alias <new>=<target>`) declaring a run-wide [value alias](#value-alias). Ranks above `--value`/`--values-file` but below anything the directive declares. See [ADR-0010](ADRs/template-variables/0010-value-alias.md).

# ADR glossary

Terms introduced while designing features with ADRs. Concepts used across the repo are in the main [glossary](../glossary.md). For the entry format and when a term moves between the two, see [Glossaries](README.md#glossaries).

### Alignment marker

A leading and/or trailing colon on a column reference (`:Name`, `Name:`, `:Name:`) requesting left/right/center alignment for that column, mirroring GFM's own `:---`/`---:`/`:---:` table delimiter-row syntax.

### `--allow-env`

A repeatable CLI option naming environment variable names a directive may reference via the `env.` placeholder namespace, mirroring `--allow-outside-root`'s allowlist pattern. From [template-variables](template-variables/README.md).

### `--allow-outside-root`

A repeatable CLI option (and matching `FileInjectorOptions.allowOutsideRoot`) naming specific extra directories a directive may resolve into, on top of the injection root. Never widens which files are discovered, and never overrides a `--deny-access` match. From [file-access-security](file-access-security/README.md).

### `--allow-remote-host`

A repeatable CLI option naming hosts exempt from the destination policy, for an internal documentation server that is a legitimate source. A redirect hop to a host not itself listed is still refused. From [security-hardening](security-hardening/README.md).

### Auto-alignment

Automatic right-alignment applied to a column with no explicit alignment marker, when enough of its data-row values look numeric or currency-like. From [table-improvements](table-improvements/README.md).

### Auto-derived prefix

The default values-file prefix, computed by stripping a leading Windows drive (`c:package.json` → `package`) and the extension from a `values-file=`/`--values-file` entry's basename. Always a single segment: a directive error if the result isn't a valid placeholder-name segment (`[A-Za-z0-9_][A-Za-z0-9_-]*`) — no automatic sanitizing, and no nesting on a dotted filename. From [template-variables](template-variables/README.md).

### Cell plain text

The visible text of a `#markdown` or `#html-table` table cell: text, code, and image alt text in order, with raw HTML dropped, and `<br />`, hard breaks and block boundaries each counted as a space. `columns` name matching and auto-alignment use it in place of the Markdown source. From [table-improvements](table-improvements/README.md).

### `column-names`

A comma-separated list, positional against the output column order, that overrides individual header labels verbatim (bypassing `header-format`). An empty entry keeps that column's existing header; it never affects column selection or `columns` name matching. From [table-improvements](table-improvements/README.md).

### Column reference

An entry in the `columns` option identifying one source column, either by 1-based number or by name (matched against the column's header match string, see below), optionally carrying an alignment marker. From [table-improvements](table-improvements/README.md).

### Data row

Any parsed source row that is not a header row. Row numbering for `start-row`/`end-row` starts at 1 from the first data row, independent of how many header rows precede it. From [table-improvements](table-improvements/README.md).

### Declaration order

The order value declarations are written in, oldest to newest: every CLI flag in argv order, then the directive's hash options left to right. The newest declaration wins, whichever option it came from. The `env.` namespace is outside the order. From [template-variables](template-variables/README.md).

### `--deny-access`

A repeatable CLI option (and matching `FileInjectorOptions.denyAccess`) of globs that refuse a directive read even inside the injection root — the operator-supplied answer to secrets that continuous integration writes into the tree. Empty by default; a match always wins over `--allow-outside-root`. From [security-hardening](security-hardening/README.md).

### Deny pattern base

What a `--deny-access` glob is matched against: the target's path relative to the injection root, except for a pattern beginning with `**/`, which is matched against the absolute path and so reaches anywhere the tool could otherwise read, including `--allow-outside-root` directories. Patterns match dotfiles, and are tested against both the textually resolved path and the realpath. From [security-hardening](security-hardening/README.md).

### Destination policy

The rule refusing a remote fetch whose host resolves to a loopback, link-local, or private address, applied to every redirect hop rather than to the literal URL alone. Closes the cloud-metadata and internal-service cases. From [security-hardening](security-hardening/README.md).

### Dynamic pattern

A `files` argument containing glob metacharacters, as opposed to a plain path naming one file. Results of a dynamic pattern are bounded by the injection root; an explicitly named file is processed wherever it lives, because the operator naming it is not the untrusted input the boundary defends against. From [security-hardening](security-hardening/README.md).

### `env.` namespace

A reserved placeholder-name prefix (`{@ env.VERSION @}`) resolving to `process.env.VERSION` when allow-listed via `--allow-env`; always reserved, even if another value source defines a top-level `env` key. From [template-variables](template-variables/README.md).

### Explicit alignment

Alignment set directly via a `columns` alignment marker; always takes precedence over auto-alignment for that column.

### Explicit prefix

The namespace written before the colon in a `values-file=`/`--values-file` entry (`pkg:package.json`). Two characters or more, so a Windows drive letter is never parsed as one; dot-separated segments, none empty and none starting with `-` or `.`. A dotted prefix nests (`pkg.build:data.json` → `{@ pkg.build.* @}`). From [template-variables](template-variables/README.md).

### Header format

A display-only casing transform (`none`/`title`/`upper`/`lower`) applied to rendered header-cell text via `header-format`. Never affects the header match string used by `columns` name references. From [table-improvements](table-improvements/README.md).

### Header match string

The text a `columns` name reference is compared against: a column's non-empty header-row cells joined with a single space (not `<br />`) and whitespace-normalized, distinct from the `<br />`-joined text actually displayed in the output header. In a `#markdown` or `#html-table` table each cell contributes its [cell plain text](#cell-plain-text), not its Markdown source. Unaffected by `header-format`. From [table-improvements](table-improvements/README.md).

### Header row(s)

The leading N rows of a table's parsed source data (N = `header-rows`, default 1) that are excluded from the data body and rendered as the table's header. From [table-improvements](table-improvements/README.md).

### `html-table` option

A bare table hash flag (`data.csv#html-table`) that emits the table as an HTML `<table>` and parses every cell as full Markdown, blocks included. Cells with markup are wrapped in blank lines so the renderer parses them; plain cells stay on one line. Newlines follow Markdown, alignment is an `align` attribute, and multiple header rows are real `<thead>` rows. Implies Markdown cells, and wins over `#markdown` when both are given. From [table-improvements](table-improvements/README.md).

### JSON table source

A `.json` file referenced by `@@inject-table:` (never by plain `@@inject:`, which still gives a code block), parsed with strict `JSON.parse`. It must be a non-empty top-level array of objects. The columns are the union of keys of the objects in the [row window](#row-window), in first-seen order (all keys when the window is empty), and the keys form the single header row. Numbers and booleans render via `String()`, and `null` is empty. Nested values become a pretty-printed `json` code block under `#html-table`, an inline code span with `#markdown`, and compact JSON text otherwise. From [table-improvements](table-improvements/README.md).

### `markdown` option

A bare table hash flag (`data.csv#markdown`) that parses every cell of a GFM pipe table as inline Markdown instead of literal text. This covers header cells, data cells, and `column-names` labels. Block syntax stays literal, pipes are escaped by the tool, newlines in a field become `<br />`, and raw HTML passes through. Opt-in, and a no-op on non-table injections. From [table-improvements](table-improvements/README.md).

### Per-leaf resolution

Resolving a placeholder name by walking [value layers](#value-layer) in order and taking the first that holds that exact name as a scalar. A layer lacking the name, or holding an object, array or `null` at it, is skipped rather than ending the search — so `--value package.engines.node=26.0` overrides one leaf of a values file without hiding its siblings. Nothing is deep-merged; "merge" describes only the observable result. From [template-variables](template-variables/README.md).

### Placeholder name

The dotted path inside a placeholder (e.g. `package.version`), each segment `[A-Za-z0-9_][A-Za-z0-9_-]*` — a hyphen is allowed inside a segment but never at its start. A dotted name traverses into nested objects from a JSON value source. From [template-variables](template-variables/README.md).

### `rebase-links` option

A boolean hash key (`part.md#rebase-links=false`) that turns rebasing off (or explicitly on) for one directive. Rebasing is on by default; the run-wide `--no-rebase-links` CLI flag turns it off, and a directive's own value wins over the CLI. From [relative-links](relative-links/README.md).

### `--rebase-output-links`

An opt-in CLI flag, requiring `--output-dir`, that rebases the relative links of every written file (the host's own links and injected content alike) so they resolve from the output location. With an `http(s)` URL value, links become that base plus the path from `--cwd` instead. It implies `--no-inject-only`, and runs after source-to-host rebasing, whatever `rebase-links` says. Designed, not yet implemented. From [relative-links](relative-links/README.md).

### Root merge (`:path`)

A `values-file=`/`--values-file` entry written with an empty prefix (a leading colon, no name before it), contributing that file's keys directly to the root namespace instead of under an auto-derived or explicit prefix — the opt-out for a directive that wants bare placeholder names from a single file. It is an ordinary [value layer](#value-layer) with no prefix, so two root-merged entries resolve per leaf rather than the later one replacing the earlier. From [template-variables](template-variables/README.md).

### Row window

The range of data rows actually injected, determined by `start-row`, `end-row`, and `num-rows` together. From [table-improvements](table-improvements/README.md).

### `--strict-vars`

A CLI flag making an unresolved placeholder a directive error (via `file.error()`, respecting `--stop-on-errors`/`--write-on-error`) instead of the default warn-and-leave-untouched behavior. From [template-variables](template-variables/README.md).

### Unresolved placeholder

A placeholder no [value layer](#value-layer) holds as a scalar — either nothing defines the name, or every layer that has it holds an object, array or `null` there. The warning distinguishes the two. Left untouched in the output with one warning per unique name per directive by default; becomes a directive error under `--strict-vars`. From [template-variables](template-variables/README.md).

### `--value`

A repeatable CLI option (`--value name=val`) setting a run-wide placeholder value, available to any directive that opts into scanning. From [template-variables](template-variables/README.md).

### Value alias

A mapping from one [placeholder name](#placeholder-name) to another, declared with the `value-alias=` directive option or the `--value-alias` CLI option. It holds no value of its own: resolving the aliased name resolves the target through the normal layer walk, so it always reflects what the sources currently say. Takes part in [declaration order](#declaration-order) like a value: for a given name, the newest of an alias and a value decides it. From [template-variables](template-variables/README.md).

### `--value-alias`

A repeatable CLI option (`--value-alias <new>=<target>`) declaring a run-wide [value alias](#value-alias). Ordered with `--value`/`--values-file` by argv position, and older than anything the directive declares. From [template-variables](template-variables/README.md).

### `value-alias=` option

A directive hash option declaring aliases as comma-separated `new:target` pairs (`value-alias=version:release.latest.version`). Opts the directive into placeholder scanning, like `values=`/`value=`/`values-file=`/`vars`. From [template-variables](template-variables/README.md).

### Value declaration

One entry in the [declaration order](#declaration-order): a `values=` pair, a `value=`, a `values-file=` entry, a `value-alias=` pair, or the CLI equivalents. A declaration that supplies values is a [value layer](#value-layer). An alias (`value-alias=`/`--value-alias`) takes part in the same order but supplies no value, so it is not a layer. From [template-variables](template-variables/README.md).

### Value layer

The smallest unit supplying placeholder values: one `name:value` pair from a directive's `values=`, one `value=`, one `--value` flag, or one `values-file=`/`--values-file` entry. Layers are ordered by [declaration order](#declaration-order), newest on top. Layers are never combined into a shared value tree. From [template-variables](template-variables/README.md).

### `value=` option

A repeatable directive hash option setting exactly one placeholder value (`value=name:val`): it splits at the first `:` and the rest is the value, commas and colons included, with no quoting. A missing `:` or empty name is a directive error. Opts the directive into placeholder scanning. From [template-variables](template-variables/README.md).

### Value source precedence

Which declaration wins when several define a placeholder name. This is [declaration order](#declaration-order), newest first, applied by [per-leaf resolution](#per-leaf-resolution). It replaced an earlier fixed ranking by source type. From [template-variables](template-variables/README.md).

### `--values-file`

A repeatable CLI option naming a JSON file of run-wide placeholder values, resolved relative to `--cwd`; each occurrence takes the same `[prefix:]path` grammar as the directive-level `values-file=` option. From [template-variables](template-variables/README.md).

### `values-file=` option

A directive hash option naming one or more JSON files of placeholder values (`values-file=[prefix:]path[,...]`, or the key repeated), each resolved relative to the containing document and subject to the injection-root boundary like any directive file reference. From [template-variables](template-variables/README.md).

### Values-file prefix

The namespace a `values-file=`/`--values-file` entry's keys are placed under, addressed via a dotted [placeholder name](#placeholder-name) (e.g. `{@ package.version @}`). Auto-derived from the file's basename by default, settable explicitly (`prefix:path`), or opted out of via [root merge](#root-merge-path) (`:path`). From [template-variables](template-variables/README.md).

### `values=` option

A directive hash option supplying inline placeholder values as comma-separated `name:value` pairs (`values=name:val,name2:val2`), with whole-value quoting for literal commas/colons. Each pair is a [value declaration](#value-declaration) ranked by [declaration order](#declaration-order). From [template-variables](template-variables/README.md).

### `vars` flag

A bare directive hash flag (`#vars`) that opts a directive into placeholder scanning against CLI/environment value sources alone, when it defines no `values=`/`values-file=` of its own. From [template-variables](template-variables/README.md).

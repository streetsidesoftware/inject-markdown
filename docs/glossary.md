# Glossary

Concepts used across `inject-markdown`. A term used by only one feature is defined in its [design](designs/README.md).

### Bare/flag option

An option written without `=value` (e.g. `#header-rows`), which takes on a documented default rather than requiring an explicit value. Currently only `header-rows` supports this form.

### Directive

An HTML-comment instruction in a Markdown file (`<!--- @@inject: file --->` and variants) that tells `inject-markdown` to pull content from another file. See [Directive.ts](../src/FileInjector/Directive.ts).

### Hash/fragment options

Directive options encoded in the `#` fragment of the file reference (e.g. `file.csv#header-rows&start-row=2`), parsed by `parseHashString`. See [hash.ts](../src/util/hash.ts).

### Injection root

The directory (default: `cwd`) that every local (`file:`) `@@inject`-family directive's resolved, realpath'd target must stay inside; a reference resolving outside it is a fatal error. Applies only to local file reads, not remote `http(s)` fetches. See the [injection root guide](guide/injection-root.md).

### Placeholder

A `{@ name @}` marker inside injected content, replaced with a value resolved against sources the _directive_ (not the injected file) supplies. Whitespace inside the delimiters is optional and trimmed. Not a full template engine — no conditionals or loops. See the [template variables design](designs/template-variables/README.md).

### Rebasing (relative links)

Rewriting a path-relative URL in injected Markdown (including `#markdown`/`#html-table` table cells, but not Markdown injected as a code block) so it resolves from the host file the same way it resolved from the source file. Applies to `link`, `image`, and `definition` nodes. Absolute, protocol-relative (`//`), root-relative (`/`), and fragment-only (`#`) URLs, and raw HTML attributes, are left untouched. See the [relative links guide](guide/relative-links.md).

### Table injection

A directive whose source file resolves to a `.csv`/`.tsv` file (or is explicitly `@@inject-table`), rendered as a GFM Markdown table instead of Markdown content or a code block. Under `@@inject-table`, a `.json` file holding an array of objects is a table source too. See [FileInjector.ts](../src/FileInjector/FileInjector.ts).

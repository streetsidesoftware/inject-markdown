# Glossary

Concepts used across `inject-markdown`. Terms introduced by a single feature's ADRs are in the [ADR glossary](ADRs/glossary.md). For the entry format and when a term moves between the two, see [Glossaries](ADRs/README.md#glossaries).

### Bare/flag option

An option written without `=value` (e.g. `#header-rows`), which takes on a documented default rather than requiring an explicit value. Currently only `header-rows` supports this form.

### Directive

An HTML-comment instruction in a Markdown file (`<!--- @@inject: file --->` and variants) that tells `inject-markdown` to pull content from another file. See [Directive.ts](../src/FileInjector/Directive.ts).

### Hash/fragment options

Directive options encoded in the `#` fragment of the file reference (e.g. `file.csv#header-rows&columns=Name,Age:`), parsed by `parseHashString`. See [hash.ts](../src/util/hash.ts). From [table-improvements](ADRs/table-improvements/README.md).

### Injection root

The directory (default: `cwd`) that every local (`file:`) `@@inject`-family directive's resolved, realpath'd target must stay inside; a reference resolving outside it is a fatal error. Applies only to local file reads, not remote `http(s)` fetches. It also bounds which files are discovered and processed, not only which may be read. From [file-access-security](ADRs/file-access-security/README.md) and [security-hardening](ADRs/security-hardening/README.md).

### Placeholder

A `{@ name @}` marker inside injected content, replaced with a value resolved against sources the _directive_ (not the injected file) supplies. Whitespace inside the delimiters is optional and trimmed; a leading backslash (`\{@ ... @}`) escapes it to literal text. Not a full template engine — no conditionals or loops. From [template-variables](ADRs/template-variables/README.md).

### Rebasing (relative links)

Rewriting a path-relative URL in injected Markdown (including `#markdown`/`#html-table` table cells, but not Markdown injected as a code block) so it resolves from the host file the same way it resolved from the source file. Applies to `link`, `image`, and `definition` nodes. Absolute, protocol-relative (`//`), root-relative (`/`), and fragment-only (`#`) URLs, and raw HTML attributes, are left untouched. From [relative-links](ADRs/relative-links/README.md).

### Table injection

A directive whose source file resolves to a `.csv`/`.tsv` file (or is explicitly `@@inject-table`), rendered as a GFM Markdown table instead of Markdown content or a code block. Under `@@inject-table`, a `.json` file is a [JSON table source](ADRs/glossary.md#json-table-source). See [FileInjector.ts](../src/FileInjector/FileInjector.ts). From [table-improvements](ADRs/table-improvements/README.md).

# ADR-0008: `markdown` option — Markdown in pipe-table cells

**Status:** Accepted
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

`rowsToTable` ([Table.ts](../../../src/FileInjector/Table.ts)) turns every parsed CSV/TSV field into a single mdast `text` node. remark-stringify then escapes any Markdown syntax in it, so a source cell is always rendered literally:

```text
source cell                          output today
**bold**                             \*\*bold\*\*
see [docs](https://x.y) and `a|b`    see \[docs]\(https\://x.y) and \`a\|b\`
<b>hi</b>                            \<b>hi\</b>
"line1<newline>line2" (quoted)       line1&#xA;line2
```

That is the right default for plain data. But CSVs are often hand-maintained doc tables (feature matrices, option lists) whose cells hold links, code spans, and emphasis the author wants rendered. There is currently no way to get them.

This ADR covers `#markdown`, which keeps the GFM pipe-table form and so limits cells to inline content. [ADR-0010](0010-table-html-table.md) covers `#html-table`, which emits an HTML `<table>` whose cells can hold full Markdown, blocks included.

The option lives in the `#`-fragment like the other table options ([ADR-0001](0001-table-option-encoding-conventions.md)). Note that `parseHashString` ([hash.ts](../../../src/util/hash.ts)) today assigns any unrecognized bare key to `info.heading`, so a new bare flag must be recognized explicitly.

## Decision

1. **Opt-in bare flag `#markdown`.** `data.csv#markdown` parses cell text as Markdown. It uses the same `parseFlagValue` handling as `quote`/`vars`, so `markdown=false` is also accepted. Without it (and without `#html-table`), behavior is unchanged: cells are literal text. When `#html-table` is also present, it takes over ([ADR-0010](0010-table-html-table.md)) and `#markdown` is redundant, not an error. `parseHashString` handles `markdown` explicitly and sets `InjectInfo.markdown`, so the bare key never falls through to `heading`.

2. **Table injections only; a no-op elsewhere.** On a Markdown or code injection (`notes.md#markdown`, `script.ts#markdown`) the flag has no effect and is not an error. It does not force table mode, and it does not turn a code-block injection into a Markdown injection.

3. **Header and data cells alike.** The flag applies to every cell: header rows ([ADR-0002](0002-table-header-rows-option.md)), data rows, and `column-names` override labels ([ADR-0007](0007-table-column-names.md)). Synthesized numeric headers under `header-rows=0` are plain numbers and unaffected.

4. **Inline content only.** Each cell is parsed as GFM _phrasing_ content: text, emphasis, strong, delete (strikethrough), inline code, links, autolinks, images, inline HTML, and hard breaks. That is everything a GFM table cell can hold.

5. **Block syntax renders literally.** A cell whose text would start a block construct (`# Title`, `- item`, `1. first`, `> note`, `---`, a fence) is not an error and is not unwrapped. Its text renders as written, escaped as needed so it stays literal in the output (e.g. `# Title` shows `# Title`). Inline syntax inside it is still parsed.

6. **Pipes are escaped by the tool.** The author writes a plain `|` in the CSV, and the output always escapes it (`\|`), including inside code spans, so a cell can never split the table. The author never pre-escapes pipes.

7. **Newlines become `<br />`.** In a `#markdown` table, a newline inside a quoted CSV field becomes an inline `<br />`, the same separator [ADR-0002](0002-table-header-rows-option.md) uses to join multi-row headers. `\r\n` and `\n` are treated alike. Literal-text tables keep today's output.

8. **Raw HTML passes through.** Inline HTML in a cell (`<b>`, `<br>`, `<sup>`) is emitted verbatim, as it is when injecting a `.md` file. Sanitizing is the renderer's job; `inject-markdown` does not sanitize HTML anywhere else either.

9. **Placeholders are substituted before parsing.** `{@ name @}` substitution still runs on the parsed CSV field values, per [template-variables/ADR-0006](../template-variables/0006-substitution-mechanics-and-timing.md) (no phantom columns). It runs _before_ the Markdown parse, so a substituted value like `*draft*` renders italic. This matches placeholders in an injected `.md` file.

## Options Considered

- **On by default, with an opt-out flag.** Rejected: a breaking change for every existing CSV holding literal `*`, `_`, `[` or `<`, which the escaping currently protects.
- **Run-wide CLI flag (`--table-markdown`) plus a per-directive override.** Rejected: more surface for no demonstrated need. Markdown content is a property of a particular source file, not of a run.
- **Flag name `md`.** Rejected: too cryptic next to the full-word options.
- **Flag name `cell-format=markdown|text`.** Rejected: an enum with one non-default value, which is verbose for the common case.
- **Flag names `#table-markdown`, with a companion `#table` that forces table mode.** Considered, then dropped. The user chose plain `#markdown` and decided a `#table` flag is out of scope; `@@inject-table:` remains the only way to force a table.
- **Only an HTML-table form under `#markdown`.** Tried briefly and then split out: the HTML form allows block content but changes the output shape and depends on the renderer. Authors who only need inline links and emphasis keep an ordinary pipe table with `#markdown`, and those who need more use `#html-table` ([ADR-0010](0010-table-html-table.md)).
- **Data cells only (headers stay literal), or separate header/body flags.** Rejected: one rule for the whole table is easier to predict. The interactions with `columns` matching and `header-format` are handled in [ADR-0009](0009-table-markdown-interactions.md) instead of by exempting headers.
- **Parse full Markdown and flatten blocks into `<br />`-separated inline content.** Rejected: lossy (list markers, heading levels), complex, and surprising.
- **Block syntax as a directive error.** Rejected: it would force authors to escape ordinary values such as `- 5` or `1. first`.
- **Unwrap block constructs (`# Title` → `Title`).** Rejected: silently drops what the author wrote.
- **Author pre-escapes pipes.** Rejected: an unescaped `|` would silently corrupt the table.
- **Newlines as a space (soft wrap), or keep `&#xA;`.** Rejected: loses the author's intended line break. `<br />` is already the table-group convention.
- **Escape raw HTML.** Rejected: it would also block `<br>`/`<sup>`, which are common in table cells, and would be inconsistent with `.md` injection.
- **Substitute placeholders after parsing, into text nodes only.** Rejected: inconsistent with how placeholders behave in injected Markdown.
- **`#markdown` as a directive error on non-table injections.** Rejected: the flag is harmless there, and an error would be noise.

## Consequences

- `InjectInfo` gains `markdown?: boolean`. `rowsToTable` needs a cell-conversion path that parses phrasing content (e.g. the existing `remark-parse` + `remark-gfm` pipeline, taking the paragraph's children) in place of the single `text` node.
- The block-syntax rule (5) means the parser must never yield a block node for a cell. One way is to parse the cell as a paragraph's contents, with a literal-text fallback for any leading block marker. The implementation has to verify this with tests for each block construct listed.
- Pipe escaping inside code spans depends on remark-stringify's GFM table handling. Tests must cover `` `a|b` `` explicitly.
- Enabling `#markdown` on a CSV with incidental `*`/`_` (e.g. `file_name`, `2*3`) changes its rendering. That is the opt-in's cost and belongs in the README.
- HTML pass-through means a `#markdown` table built from an untrusted CSV can carry arbitrary HTML into the output. This is the same exposure as injecting an untrusted `.md` file, and should be noted alongside the security docs.

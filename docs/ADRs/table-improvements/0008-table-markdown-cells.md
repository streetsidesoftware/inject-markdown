# ADR-0008: `markdown` option — Markdown cells in an HTML table

**Status:** Proposed
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

That is the right default for plain data. But CSVs are often hand-maintained doc tables (feature matrices, option lists) whose cells hold links, code spans, emphasis, and sometimes lists or several paragraphs, all of which the author wants rendered. There is currently no way to get them.

A GFM pipe table can't hold any of that. Each cell is a single line of inline content, a literal `|` has to be escaped, and a line break needs raw `<br />`. An HTML `<table>` has none of these limits. CommonMark ends an HTML block (type 6, which covers `table`/`tr`/`td`/...) at a blank line and parses what follows as Markdown. So Markdown set off by blank lines inside `<td>` is rendered by GFM renderers such as GitHub's.

The option lives in the `#`-fragment like the other table options ([ADR-0001](0001-table-option-encoding-conventions.md)). Note that `parseHashString` ([hash.ts](../../../src/util/hash.ts)) today assigns any unrecognized bare key to `info.heading`, so a new bare flag must be recognized explicitly.

## Decision

1. **Opt-in bare flag `#markdown`.** `data.csv#markdown` parses cell text as Markdown and emits the table as HTML. It uses the same `parseFlagValue` handling as `quote`/`vars`, so `markdown=false` is also accepted. Without it, behavior is unchanged: a GFM pipe table of literal text. `parseHashString` handles `markdown` explicitly and sets `InjectInfo.markdown`, so the bare key never falls through to `heading`.

2. **Table injections only; a no-op elsewhere.** On a Markdown or code injection (`notes.md#markdown`, `script.ts#markdown`) the flag has no effect and is not an error. It does not force table mode, and it does not turn a code-block injection into a Markdown injection.

3. **Output is an HTML `<table>`.**
   - Structure: `<table>`, a `<thead>` of header rows, and a `<tbody>` of data rows. Header cells are `<th>`, data cells are `<td>`.
   - Every line starts at column 0, both tags and cell content. Indenting cell Markdown 4+ spaces would turn it into an indented code block, and a single flat rule can't collide with that.
   - Multiple header rows (`header-rows=N`, [ADR-0002](0002-table-header-rows-option.md)) become N real `<tr>` rows in `<thead>`. They are not `<br />`-joined as in the pipe form.
   - With `header-rows=0` there is no `<thead>` at all. An HTML table doesn't need a header row, so the pipe form's synthesized `1`, `2`, `3` headers are not emitted.
   - Column alignment (explicit `columns` markers per [ADR-0003](0003-table-columns-option.md), and auto-alignment per [ADR-0005](0005-table-auto-alignment.md)) is written as an `align="left|center|right"` attribute on every `<th>`/`<td>` in that column. An unaligned column gets no attribute.

4. **Header and data cells alike.** Markdown parsing applies to every cell: header rows, data rows, and `column-names` override labels ([ADR-0007](0007-table-column-names.md)).

5. **Full Markdown per cell.** Each cell's text is parsed as a standalone Markdown document with the same GFM pipeline the tool already uses. Block content is allowed: paragraphs, lists, block quotes, fenced code, headings. A quoted CSV field holding `- a⏎- b` renders a list.

6. **Newlines follow Markdown.** A newline inside a quoted CSV field means what it means in a `.md` file. A single newline is a soft wrap, and a blank line separates paragraphs. `\r\n` and `\n` are treated alike.

7. **Plain cells are compact; cells with markup are blank-line wrapped.**
   - A cell whose parse is a single paragraph of plain text only (no emphasis, code, links, HTML, or breaks) is emitted on one line, `<td>42</td>`. `&`, `<` and `>` are escaped as HTML entities, because content on a tag line is raw HTML and not parsed as Markdown.
   - An empty cell is `<td></td>`.
   - Any other cell is emitted as the opening tag, a blank line, the cell's Markdown, a blank line, and the closing tag. That lets the renderer parse it.

   Example: CSV `Name,Notes` / `x,"**new**⏎⏎- a⏎- b"` with `#markdown`:

   ```text
   <table>
   <thead>
   <tr>
   <th>Name</th>
   <th>Notes</th>
   </tr>
   </thead>
   <tbody>
   <tr>
   <td>x</td>
   <td>

   **new**

   - a
   - b

   </td>
   </tr>
   </tbody>
   </table>
   ```

8. **No pipe escaping.** A `|` in a cell is ordinary text in an HTML table, so it is emitted as-is.

9. **Raw HTML passes through.** Inline and block HTML in a cell (`<b>`, `<br>`, `<sup>`, `<details>`) is emitted verbatim, as it is when injecting a `.md` file. Sanitizing is the renderer's job; `inject-markdown` does not sanitize HTML anywhere else either.

10. **Placeholders are substituted before parsing.** `{@ name @}` substitution still runs on the parsed CSV field values, per [template-variables/ADR-0006](../template-variables/0006-substitution-mechanics-and-timing.md) (no phantom columns). It runs _before_ the Markdown parse, so a substituted value like `*draft*` renders italic. This matches placeholders in an injected `.md` file.

## Options Considered

- **On by default, with an opt-out flag.** Rejected: a breaking change for every existing CSV holding literal `*`, `_`, `[` or `<`, which the escaping currently protects.
- **Run-wide CLI flag (`--table-markdown`) plus a per-directive override.** Rejected: more surface for no demonstrated need. Markdown content is a property of a particular source file, not of a run.
- **Flag name `md`.** Rejected: too cryptic next to the full-word options.
- **Flag name `cell-format=markdown|text`.** Rejected: an enum with one non-default value, which is verbose for the common case.
- **Flag names `#table-markdown`, with a companion `#table` that forces table mode.** Considered, then dropped. The user chose plain `#markdown` and decided a `#table` flag is out of scope; `@@inject-table:` remains the only way to force a table.
- **Keep the GFM pipe form, with inline Markdown only.** The original decision here, reversed in favor of the HTML table. It limited cells to phrasing content, rendered block syntax (`# Title`, `- item`) literally, escaped pipes in the output, and turned newlines into `<br />`. The HTML form removes each of those limits, which is the point of the option.
- **Render cell Markdown to HTML in the tool (`<td><strong>b</strong></td>`).** Rejected: it would add `remark-rehype`/`rehype-stringify` dependencies, and the generated source would be much harder to read and review in a diff. It would render in any renderer, whereas the chosen form depends on the renderer following CommonMark's HTML-block rule. GitHub does.
- **Blank-line wrap every cell.** Rejected: taller output, and each wrapped cell renders inside a `<p>`, which adds vertical spacing on GitHub. Compact plain cells avoid both. The cost is that a row can mix the two forms.
- **Indent `<tr>`/`<td>` tags for readability.** Rejected: cell Markdown must still start at column 0. Mixing indented tags with flush-left content makes the indentation misleading, and it is easy to break by hand.
- **`style="text-align:…"` for alignment.** Rejected: GitHub's sanitizer strips `style`, so alignment would be lost there. `align` is deprecated in HTML5 but kept by GitHub, and it is what GitHub's own pipe-table renderer emits.
- **`<br />`-joined multi-row headers, or synthesized numbered headers for `header-rows=0`, as in the pipe form.** Rejected: both are workarounds for GFM's single mandatory header row, which an HTML table doesn't have.
- **Newlines as `<br />`.** Rejected: with block content allowed, a blank line has to mean a paragraph break, as it does everywhere else in Markdown.
- **Escape raw HTML.** Rejected: it would also block `<br>`/`<sup>`/`<details>`, which are common in table cells, and would be inconsistent with `.md` injection.
- **Substitute placeholders after parsing, into text nodes only.** Rejected: inconsistent with how placeholders behave in injected Markdown.
- **`#markdown` as a directive error on non-table injections.** Rejected: the flag is harmless there, and an error would be noise.

## Consequences

- `InjectInfo` gains `markdown?: boolean`. Table building gets a second output path that emits mdast `html` nodes for the tags, interleaved with each wrapped cell's parsed block children. remark-stringify's blank line between sibling blocks then produces the wrapping. The existing pipe-form path is untouched.
- Rendering depends on the target renderer following CommonMark's HTML-block rule. GitHub, GitLab, and markdown-it/micromark-based renderers do. The README should say `#markdown` output is meant for GFM-style renderers.
- Each wrapped cell renders its content inside `<p>` (or other block) elements, so spacing differs slightly from a pipe table. Compact plain cells don't have this.
- A cell's raw HTML can close the surrounding structure (e.g. a stray `</td>` or `</table>`) and corrupt the table. With HTML pass-through this is the author's responsibility, as it is with any raw HTML in Markdown. Similarly, a `#markdown` table built from an untrusted CSV can carry arbitrary HTML into the output: the same exposure as injecting an untrusted `.md` file, and it should be noted alongside the security docs.
- Enabling `#markdown` on a CSV with incidental `*`/`_` (e.g. `file_name`, `2*3`) changes its rendering, and so does a cell starting with `-`, `#`, `>` or `1.`, which now becomes a list, heading or quote. That is the opt-in's cost and belongs in the README.
- Prettier (the repo's configured version) leaves the flush-left output unchanged in a `.md` file. It does reformat an example inside a fenced `html` block, so documentation examples use a `text` fence.
- The output is idempotent across runs because the whole section between the directive markers is regenerated. Tests should still cover a re-run over already-injected output.

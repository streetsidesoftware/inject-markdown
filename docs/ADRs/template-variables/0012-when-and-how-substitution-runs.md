# ADR-0012: When and how substitution runs

**Status:** Accepted

## Why

**Goal:** one snippet is injected into several documents with different values, whatever kind of directive injects it.

**Problem:** the three directive types build different things before splicing them in: a Markdown tree, a code string, or table cells. Substituting at the wrong point would warn about placeholders in parts that are never injected, reformat content, or let a value break a table's structure.

## Decision

1. **Substitution runs after extraction, on the content that will be injected.** Line ranges (`L1-L10`), headings (`heading=`) and table row windows are applied first. Placeholders in discarded parts are neither substituted nor reported.
2. **Markdown injections:** after the line range, the Markdown parse and the heading extraction, substitution walks the tree's `text`, `inlineCode`, `code` and `html` nodes and replaces placeholders within each node's own text, in place. The tree is not turned back into Markdown and re-parsed. Link and image URLs are not visited. After substitution, the content is wrapped in a code block (`code`, `lang=`) or its links are rebased.
3. **Code injections:** after the line range, substitution replaces placeholders in the file's text as one string. The result is then trimmed and wrapped in a code block.
4. **Table injections:** substitution runs on parsed cells, after the row window, never on the raw source text.
   - A delimited file (`.csv`, `.tsv`, ...) is cut to its line range, parsed into cells, and cut to its header rows and row window. Then each cell's text is substituted.
   - A JSON file is parsed, and the header row of keys and the windowed rows are built. Then each text cell is substituted, header keys included. Inside a nested object or array cell, each string leaf is substituted; keys inside it stay literal.
   - The table is built afterwards. Markdown cells (`#markdown`, `#html-table`) are parsed after substitution, so a value like `*draft*` renders in italics.

## Consequences

- A placeholder split across inline formatting, such as `{@ *ver*sion @}`, is not recognized, because no single text node holds it. That's a documented limit.
- A value containing the delimiter can't add columns, and a value containing `"` or `\` can't corrupt a JSON source.
- Columns are collected before substitution, so two JSON keys that substitute to the same text stay two columns.
- A `{@ … @}` in a link destination is not substituted. It is rebased like any other path text.
- Only the substituted text changes. Formatting that the default inject-only mode preserves stays byte for byte.

## Context

- The substitution routine is shared: one string function, called directly for code and table cells, and from a tree walk for Markdown.
- Substituting the raw text of a delimited table first would let a value containing the delimiter add phantom columns. That's why tables substitute parsed cells, and why JSON tables never touch the raw JSON.
- The table-improvements decisions on Markdown cells, HTML tables and JSON sources build on this rule; see [table-improvements](../table-improvements/README.md).

## Rejected approaches

- Substituting the whole raw source before extraction: it warns about placeholders that are never injected, and substitution never needs to affect what is extracted.
- Turning the Markdown tree back into text, substituting and re-parsing: an extra parse per injection, and it risks reformatting content that inject-only mode leaves untouched.
- Substituting a table's raw text: values could add columns or corrupt JSON.

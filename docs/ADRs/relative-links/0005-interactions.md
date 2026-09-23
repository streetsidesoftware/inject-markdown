# ADR-0005: Interaction with other injection options

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Rebasing ([ADR-0001](0001-rebase-scope.md)–[ADR-0004](0004-rebased-path-format.md)) was framed around plain Markdown injection. Other options also put rendered Markdown, or Markdown source, into the host file:

- `#code` / `#lang=…` on a Markdown source wraps it in a code block (`toCode` in `readAndParseMarkdownFile`, [FileInjector.ts](../../../src/FileInjector/FileInjector.ts)).
- `#quote` wraps the content in a blockquote (`applyQuote`, [Markdown.ts](../../../src/FileInjector/Markdown.ts)).
- `#markdown` and `#html-table` parse CSV/TSV cells into mdast (`parseCellMarkdown` / `parseCellBlocks`, [cellMarkdown.ts](../../../src/FileInjector/cellMarkdown.ts); see [table-improvements ADR-0008](../table-improvements/0008-table-markdown-cells.md) and [ADR-0010](../table-improvements/0010-table-html-table.md)). A cell like `[spec](spec.md)` in `data/features.csv` was written relative to the CSV file.
- `heading=` and `L…` select part of the source before it is parsed or injected.

## Decision

1. **Code blocks are not rebased.** When a Markdown source is injected as a code block (`#code` or `#lang=…`), its text is shown verbatim. The code block shows what the file contains, and rewriting it would misrepresent the source.
2. **Quotes are rebased.** `#quote` still renders its links, so they are rebased as normal.
3. **Markdown table cells are rebased, with the same rules.** Links, images and definitions produced by `#markdown` or `#html-table` cells are rebased relative to the CSV/TSV file. The same default and the same opt-outs apply (`#rebase-links=false`, `--no-rebase-links`, [ADR-0002](0002-default-on-with-opt-out.md)). Under `#html-table`, definitions are already emitted as literal text ([table-improvements ADR-0010](../table-improvements/0010-table-html-table.md) point 12), so in practice only links and images are affected there. Literal-text tables (no `#markdown`/`#html-table`) have no link nodes and are unaffected.
4. **Rebasing runs on the final tree.** It runs after `heading=`/`L…` selection, `sanitizeImport` and cell parsing, and before the content is spliced into the host by `injectContent`. So it applies to exactly the nodes that end up in the output. Placeholder substitution doesn't touch URLs ([ADR-0004](0004-rebased-path-format.md) Consequences), so the order relative to it doesn't matter.
5. **`--clean` and `--inject-only` need nothing extra.** `--clean` injects no content. `--inject-only` stringifies the same rebased tree into its patch, so both output modes agree.

## Options Considered

- **Rebase inside Markdown code blocks.** Rejected per point 1.
- **Markdown files only; leave table cells for later.** Rejected. A link in a Markdown table cell has the same problem as one in a Markdown file, and one rule for all rendered Markdown is easier to explain.

## Consequences

- `@@inject-code` of a Markdown file, and `#code`, keep showing the source's own links unchanged. That's intended.
- `heading=` and `L…` can drop a reference definition that a kept `[a][ref]` needs. That's an existing limitation, not introduced or fixed here.

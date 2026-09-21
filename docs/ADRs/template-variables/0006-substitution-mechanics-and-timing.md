# ADR-0006: Substitution mechanics and timing

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

The three directive types produce different intermediate representations before `injectContent` splices them into the parent document ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)): code and table injections end up as a single string value (`Code.value`, produced by `toCode` in [Markdown.ts](../../../src/FileInjector/Markdown.ts)), while markdown injections (`readAndParseMarkdownFile`) produce an mdast subtree with many text-bearing nodes (`text`, `inlineCode`, `code`, `html`, ...). Line-range (`L1-L10`) and heading (`heading=`) extraction also happen earlier in that same pipeline. We need one rule for where substitution runs relative to those steps, and how it interacts with a tree rather than a flat string.

## Decision

1. **Timing:** substitution runs after line-range and heading extraction, on the final content that will actually be spliced in — the last step before `injectContent` splices `root.children` into the parent document.
2. **Markdown injections:** substitution walks the resulting mdast subtree's text-bearing nodes (`text`, `inlineCode`, `code`, `html`) and replaces placeholder occurrences within each node's own string value, in place. It does not stringify the subtree to Markdown text and re-parse it.
3. **Code and table injections:** the content is already a single string (`Code.value`, or delimited-text/cell values ahead of `rowsToTable`) — substitution is a direct string replace on that value, no tree walk needed.

## Options Considered

- **Substitute before extraction, on the whole raw source file** — rejected: substitution never needs to affect line-range/heading matching (the feature's use case is inline value injection, not conditional inclusion), and running it only on the smaller, final fragment is cheaper and avoids unresolved-placeholder warnings for placeholders that live in discarded, non-injected parts of the source file.
- **Stringify the markdown subtree, substitute, re-parse** — rejected: adds a re-parse round trip per injection and risks reformatting content that `detectMarkdownStyle`/`--inject-only` mode ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)) is specifically built to leave byte-for-byte untouched. Walking text nodes in place touches only the literal substituted text.

## Consequences

- A placeholder split across Markdown inline formatting (e.g. `{@ *ver*sion @}`, where emphasis markers land mid-placeholder) is not recognized as one placeholder, since it never appears as one contiguous string within a single node. This is a documented limitation, not a bug, consistent with the feature's "not a full template engine" scope ([ADR-0001](0001-placeholder-syntax.md)).
- The substitution step is one small shared string routine (match placeholders per [ADR-0001](0001-placeholder-syntax.md), resolve per [ADR-0004](0004-value-source-precedence.md), report unresolved names per [ADR-0005](0005-unresolved-placeholders-and-strict-mode.md)), called directly on the code/table string paths and from a thin tree-walking wrapper for markdown injections.

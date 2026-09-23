# ADR-0001: What gets rebased: constructs and URL forms

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

When a Markdown file is injected, its content is copied verbatim into the host document (`readAndParseMarkdownFile` → `injectContent` in [FileInjector.ts](../../../src/FileInjector/FileInjector.ts)). Relative URLs in that content were written relative to the _source_ file's location, but after injection they are resolved relative to the _host_ file. For example, `docs/part.md` contains `![diagram](img/flow.png)`, meaning `docs/img/flow.png`. Injected into `README.md` at the repository root, the same link now points at `img/flow.png`, which does not exist.

Nothing in the pipeline touches link URLs today. `sanitizeImport` and `extractHeader` ([Markdown.ts](../../../src/FileInjector/Markdown.ts)) only remove or select nodes.

This ADR decides which URLs are rebased. How the new URL is computed is decided in [ADR-0003](0003-rebase-base-resolution.md), when rebasing applies in [ADR-0002](0002-default-on-with-opt-out.md), and how it interacts with code blocks and Markdown table cells in [ADR-0005](0005-interactions.md).

## Decision

1. **Constructs: mdast `link`, `image`, and `definition` nodes.** These cover inline links `[a](x.md)`, images `![a](x.png)`, and reference definitions `[a]: x.md`, which are used by `[a][ref]` and `![a][ref]`. All three hold the target in the same `url` field, so one rewrite covers them. Including definitions means an inline link and a reference-style link to the same file behave the same.
2. **Raw HTML is not rewritten in this release.** `<img src="…">`, `<a href="…">`, `srcset`, `<source src>` and similar attributes inside `html` nodes are left as-is. Rewriting them needs attribute parsing of raw HTML strings. It can be added later as a separate ADR.
3. **Only path-relative URLs are rebased.** A URL is rebased when it has no scheme and does not start with `/` or `#`: `x.md`, `./x.md`, `../x.md`, `img/a.png`. These are left untouched:
   - absolute URLs with any scheme (`https:`, `http:`, `mailto:`, `file:`, `data:`, …),
   - protocol-relative URLs (`//host/path`),
   - root-relative URLs (`/docs/x.md`), whose meaning depends on the host (on GitHub, `/` is the repository root) and doesn't change with the file's location,
   - fragment-only URLs (`#section`), which point at a heading in the rendered page, not at a file.

## Options Considered

- **Links and images only; defer definitions.** Initially chosen to keep the first release small, then reversed. `[a](img.png)` would be fixed while `[a][ref]` with `[ref]: img.png` stayed broken. Because definitions use the same `url` field, including them costs almost nothing.
- **Include raw HTML attributes now.** Deferred. Parsing attributes out of raw HTML strings is more fragile than editing mdast nodes, and it's a separate piece of work.
- **Also rebase root-relative `/…` URLs.** Rejected. There is no single root to rebase against (repository root, injection root, or web server root), and on GitHub a root-relative link already works from any file in the repository.

## Consequences

- An injected file that uses `<img src="relative.png">` still breaks after injection. Documentation should say so until raw HTML is covered Covering it is listed under Future work in the [group index](README.md#future-work).
- A fragment-only link `#section` still depends on the target heading being present in the host document, for example when `heading=` selects only part of the source file. This ADR doesn't change that.

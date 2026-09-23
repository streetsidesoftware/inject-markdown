# ADR-0007: `--rebase-output-links [base]`: rebase links onto the output location

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0003](0003-rebase-base-resolution.md) point 3 keeps `--output-dir` from changing the base of rebased links. A file written to `out/README.md` still links as if it sat at `README.md`, like the host file's own links always have. That's consistent, but none of the relative links in the output tree work from where the file is written.

Two use cases need the links to work from the output instead:

- **Output kept in the repository.** Generated docs are written to `out/` and read there, so `docs/img.png` must become `../docs/img.png`.
- **Output read detached from the tree.** A README published to npm or another registry is shown without the repository around it, so relative links only work as absolute URLs (`https://github.com/o/r/blob/main/docs/img.png`).

In `__processFile` ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)), every processed Markdown file is written to `--output-dir`, including files with no directives, which are copied byte-for-byte. `--inject-only` (the default) writes by patching only the injected spans.

This ADR decides what the flag does and when it applies. How individual links are interpreted is in [ADR-0008](0008-output-link-semantics.md).

## Decision

1. **An opt-in CLI flag, `--rebase-output-links [base]`.** It is off by default. It rebases the relative links in each written file so they resolve from the file's output location, or from `base`. That covers the host file's own links and injected content alike. The value is optional.
2. **Requires `--output-dir`.** Given without `--output-dir`, it is an error. The flag only ever changes the generated copy, never the source tree.
3. **Two forms.** Example: source `README.md` links to `docs/img.png`, and the file is written to `out/README.md`.
   - **No value:** the link is made relative to the output file: `../docs/img.png`. It still points into the source tree, except for links to other processed files ([ADR-0008](0008-output-link-semantics.md) point 1).
   - **URL value:** the link becomes the base URL plus the target's path from `--cwd`: `--rebase-output-links https://github.com/o/r/blob/main/` gives `https://github.com/o/r/blob/main/docs/img.png`. The base stands for `--cwd`.
4. **Every written file.** Files with no directives, which are otherwise copied byte-for-byte, are parsed and have their links rebased too. The flag describes the output tree as a whole, and a copied file with broken links would defeat it.
5. **Same link scope as source-to-host rebasing.** Inline links, images and reference definitions with path-relative URLs, per [ADR-0001](0001-rebase-scope.md). Raw HTML, code blocks, and absolute, `//`, `/`-rooted and `#`-only URLs are left alone.

## Options Considered

- **Allow it without `--output-dir`, with a URL base.** Rejected. It would permanently rewrite authored links in the source file into absolute URLs, and the next run would then see absolute links it can no longer rebase.
- **A directory value** (`--rebase-output-links site`, meaning "the source tree is published at `site/`"). Deferred until there's a concrete use case. The no-value and URL forms cover the two known ones.
- **Only files with directives.** Rejected per point 4. Relative links in copied files would break in the output location.

## Consequences

- With the flag, a file without directives is no longer a byte-for-byte copy. It is written with its links rebased, and possibly other formatting changes depending on how it is rewritten ([ADR-0009](0009-output-rebase-mechanics.md)).
- ADR-0003 point 3 still holds when the flag is absent. The flag is the opt-in alternative that ADR-0003's Consequences point to.

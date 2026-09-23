# ADR-0008: How `--rebase-output-links` interprets a link

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0007](0007-rebase-output-links.md) turns on rebasing of every written file's links onto its output location or a URL base. Some links need a specific rule:

- a link from one processed file to another, since both have output copies,
- root-relative links, which [ADR-0001](0001-rebase-scope.md) leaves alone, and which could look resolvable against a URL base.

## Decision

1. **No value: links to processed files point at their output copies.** When a link's target is one of the files processed in this run, and so written to `--output-dir`, the link points at that output copy. Because the output tree mirrors the source tree under `--cwd`, the relative link is unchanged: `a.md` → `b.md` stays `b.md` in `out/a.md`. Every other target (images, source files, Markdown files not processed in this run) points into the source tree from the output location (`../docs/img.png`). A self-link such as `README.md#usage` in `README.md` is a link to a processed file, so it stays as is.
2. **URL value: every rebased link becomes absolute.** With a URL base, all path-relative links become the base plus the target's path from `--cwd`, including links to other processed files: `b.md` → `https://github.com/o/r/blob/main/b.md`. A URL base means the file is read detached from the tree, where a relative link to a sibling output copy wouldn't resolve either.
3. **Root-relative links stay untouched in both forms.** `/docs/x.md` means the repository root on GitHub, which need not equal `--cwd`, the directory the base stands for. Resolving it against the base could produce a plausible-looking but broken URL. This is consistent with ADR-0001 point 3.
4. **The processed set is this run's file list.** "Processed in this run" means the files `processGlobs` ([process.mts](../../../src/processor/process.mts)) selects from the command line, so the same command always gives the same output.

## Options Considered

- **Treat any `.md` under `--cwd` as having an output copy.** Rejected. It doesn't depend on the file list, but a link to a Markdown file that wasn't processed, and so has no output copy, would break.
- **Always point into the source tree.** Rejected. Output pages would link to source pages instead of each other, so a reader moving between output pages would leave the output tree.
- **Keep links to processed files relative even with a URL base.** Rejected per point 2.
- **Resolve root-relative links against the URL base, treating `/` as `--cwd`.** Rejected per point 3. It's only right when `--cwd` is the repository root.

## Consequences

- The output of one file depends on which other files the same run processes. Running `inject-markdown a.md` and `inject-markdown a.md b.md` with the same flags can produce different links in `out/a.md`.
- Implementation: the injector needs the run's file set, which `FileInjector.processFile` doesn't receive today.

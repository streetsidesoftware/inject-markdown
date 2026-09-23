# ADR-0009: Mechanics of output rebasing

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0007](0007-rebase-output-links.md) and [ADR-0008](0008-output-link-semantics.md) decide what `--rebase-output-links` produces. This ADR decides how it fits into the existing pipeline in `processFileInjections` ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)):

- `--inject-only` (the default) builds the output by patching only the injected spans (`applyPatches` in [patchContent.ts](../../../src/FileInjector/patchContent.ts)). The rest of the file is kept byte-for-byte. This flag rewrites links outside those spans.
- `processFileContent` returns early for a file with no `@@inject` text, and such a file is then copied unchanged.
- Source-to-host rebasing ([ADR-0002](0002-default-on-with-opt-out.md)) already runs per directive and can be turned off with `#rebase-links=false` or `--no-rebase-links`.

## Decision

1. **The flag implies `--no-inject-only`.** With `--rebase-output-links`, the whole document is re-stringified, as with `--no-inject-only`. Output style is still detected from the source file (`detectMarkdownStyle`, [detectStyle.ts](../../../src/FileInjector/detectStyle.ts)), which keeps list markers, fences and similar constructs as the file wrote them. Formatting remark can't reproduce exactly may still change in the output copy.
2. **Files without directives go through the pipeline.** With the flag on, the early return for a file without `@@inject` text is skipped, so the file is parsed, has its links rebased and is re-stringified before it is written ([ADR-0007](0007-rebase-output-links.md) point 4).
3. **Two stages, in order.**
   - **Stage 1, per directive:** source to host, as today. It is skipped for a directive with `#rebase-links=false` or a run with `--no-rebase-links`.
   - **Stage 2, whole file:** host to output, over the final tree, covering the host's own links and all injected content.

   Stage 2 applies to content from opted-out directives too. Their links were written relative to the host, so rebasing them from the host to the output is still correct. `--no-rebase-links` and `#rebase-links=false` only control stage 1.

4. **Targets outside `--cwd` under a URL base: warn and fall back.** A target outside `--cwd` (e.g. `../other/x.md` from `README.md`) has no path under the base. Adding `../` to the base would climb above it (`…/blob/other/x.md`). Such a link is rebased as in the no-value form, relative to the output file, and a warning (`file.message`) names the link. The output stays deterministic, and the author learns the link can't be expressed under the base.
5. **`--clean` output is rebased too.** With `--clean`, injected sections are removed and the file is still written to `--output-dir`, so stage 2 applies to what remains. `--dry-run` writes nothing.

## Options Considered

- **Patch each changed link, keeping `--inject-only`.** Replace just the source span of each changed link, image or definition with its re-stringified form, through `applyPatches`. Everything else would stay byte-for-byte. Not chosen, in favor of reusing the existing whole-document path. It trades exact formatting preservation in the output copy for a simpler implementation: the source file is never touched ([ADR-0007](0007-rebase-output-links.md) point 2), so only the generated copy is reformatted.
- **Exempt opted-out directives from stage 2.** Rejected. `#rebase-links=false` means "these links are already relative to the host", not "never touch these links". Skipping stage 2 would leave them broken in the output.
- **Treat a target outside `--cwd` as an error.** Rejected in favor of a warning. The fallback link is no more broken than before, and a hard error would block the whole run for one link.
- **Resolve it against the base anyway.** Rejected. It's only right when the base's parent maps to `--cwd`'s parent, which the tool can't know.

## Consequences

- The output copy of every file can differ in formatting from its source, not only in links. That includes files without directives. Diffing output against source shows these changes.
- The warning in point 4 goes through the existing message reporting, so it shows up per file and doesn't fail the run.

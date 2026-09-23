# ADR-0006: Rollout as a minor release

**Status:** Accepted
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Rebasing is on by default ([ADR-0002](0002-default-on-with-opt-out.md)), so existing documents whose injected Markdown (or Markdown table cells, [ADR-0005](0005-interactions.md)) contains relative links will change on the next run. We need to decide the release type. Precedent: [file-access-security ADR-0003](../file-access-security/0003-rollout-as-major-version-bump.md) shipped the injection-root boundary as a major version, because it turned previously working directives into errors.

This repository relies on the old behavior itself. `README.md` injects `content/README.md` (`<!--- @@inject: content/README.md --->`), and `CONTRIBUTING.md` tells authors to write links in `content/README.md` relative to the repository root, because they are read from the root `README.md`. Two links follow that rule today: `docs/guide/injection-root.md` and `docs/guide/template-variables.md`. With rebasing on, they would become `content/docs/guide/…` in `README.md`, which is broken.

## Decision

1. **Ship as `feat:`, a minor release.** The links that change were broken whenever the source and host files are in different directories and the author didn't work around it. The feature adds a hash key and a CLI flag and fixes that output. No directive starts failing.
2. **Call out the behavior change.** The feature's commit and PR description, and so the Release Please changelog entry, say that injected relative links are now rebased by default and name the opt-outs `--no-rebase-links` and `#rebase-links=false`.
3. **Document it as CONTRIBUTING.md's "Documenting a new feature" describes.** In `content/README.md` (which regenerates `README.md`), add a `rebase-links` row to the **Injection options** table and a `--no-rebase-links` mention, and add a recipe showing a rebased link. Put the detailed rules in a new `docs/guide/` page, linked from the README: which URLs are and aren't rewritten (raw HTML, root-relative, absolute and fragment-only URLs, code blocks), remote sources, `--output-dir`, table cells and precedence.
4. **Migrate this repository in the same PR as the implementation.** Rewrite the links in `content/README.md` relative to `content/` (`docs/guide/…` → `../docs/guide/…`), and replace the CONTRIBUTING.md note about repository-root links with a note that links are written relative to the file they're in. After rebasing, the links resolve in `README.md` and also resolve when viewing `content/README.md` directly, which the old convention couldn't do. This must land together with the feature: `pnpm build:readme` on the feature alone would break `README.md`. The same migration is the worked example in the changelog entry for users who used the same workaround.

## Options Considered

- **Major version (`feat!:`).** Rejected. Unlike the injection-root change, nothing that worked before now errors. The authors whose output gets worse are those who wrote source links relative to the host file as a workaround, as this repository did. `--no-rebase-links` or `#rebase-links=false` restores the old output in one flag, and fixing the links is a mechanical edit. That this repository documented the workaround was weighed as a sign other users follow it too, but judged covered by the changelog callout and opt-outs.
- **`fix:` patch.** Rejected: a patch that adds a CLI flag and hash key and changes output reads as a minor change in Conventional Commits.
- **Keep this repository's convention and opt out** (`content/README.md#rebase-links=false` in `README.md`). Rejected. It's the smallest diff, but it keeps the workaround the feature exists to remove, in the project's own flagship example.

## Consequences

- Anyone who worked around the old behavior sees their links change after a minor upgrade. The changelog entry and README documentation are their signal.
- `content/README.md` links become correct when the file is viewed on its own, not only in `README.md`.

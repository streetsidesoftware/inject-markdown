# ADR-0006: Rollout as a minor release

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Rebasing is on by default ([ADR-0002](0002-default-on-with-opt-out.md)), so existing documents whose injected Markdown (or Markdown table cells, [ADR-0005](0005-interactions.md)) contains relative links will change on the next run. We need to decide the release type. Precedent: [file-access-security ADR-0003](../file-access-security/0003-rollout-as-major-version-bump.md) shipped the injection-root boundary as a major version, because it turned previously working directives into errors.

## Decision

1. **Ship as `feat:`, a minor release.** The links that change were broken whenever the source and host files are in different directories. The feature adds a hash key and a CLI flag and fixes that output. No directive starts failing.
2. **Call out the behavior change.** The feature's commit and PR description, and so the Release Please changelog entry, say that injected relative links are now rebased by default and name the opt-outs `--no-rebase-links` and `#rebase-links=false`.
3. **Document it in the README source.** Add a section to `content/README.md` (which regenerates `README.md`; don't edit the injected sections of `README.md` directly) covering the default, the opt-outs, and what is not rewritten: raw HTML, root-relative, absolute and fragment-only URLs, and code blocks.

## Options Considered

- **Major version (`feat!:`).** Rejected. Unlike the injection-root change, nothing that worked before now errors. The only authors whose output gets worse are those who wrote source links relative to the host file as a workaround, and `--no-rebase-links` restores that in one flag.
- **`fix:` patch.** Rejected: a patch that adds a CLI flag and hash key and changes output reads as a minor change in Conventional Commits.

## Consequences

- Anyone who worked around the old behavior sees their links change after a minor upgrade. The changelog entry and README section are their signal.

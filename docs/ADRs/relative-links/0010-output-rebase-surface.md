# ADR-0010: `--rebase-output-links` surface, validation, and rollout

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0007](0007-rebase-output-links.md)–[ADR-0009](0009-output-rebase-mechanics.md) decide what output rebasing does. What remains is the exact CLI and library surface, how bad input is reported, and how it ships. Existing precedents in [app.mts](../../../src/app.mts):

- A bad operator-supplied option (e.g. `--values-file`) throws `OptionError`, which the CLI reports as a command error rather than a document error.
- A CLI option must also be added to the `Options`/`FileInjectorOptions` interfaces ([CLAUDE.md](../../../CLAUDE.md)).

## Decision

1. **CLI: `--rebase-output-links [base]`.** The value is optional. Without one, links are rebased relative to the output file. With one, they're rebased onto that base.
2. **The value must be an `http:` or `https:` URL.** Anything else, including `file:` URLs and paths, is an `OptionError`. That keeps the deferred directory form ([ADR-0007](0007-rebase-output-links.md) Options Considered) free to be added later without changing what an existing value means.
3. **A trailing slash is added to the base.** `https://github.com/o/r/blob/main` is treated as `https://github.com/o/r/blob/main/`. URL resolution against a base without a trailing slash would drop its last segment (`main`), which is never what the author means. Query and fragment in the base are not allowed; an `OptionError` names them.
4. **Missing `--output-dir` is an `OptionError`** ([ADR-0007](0007-rebase-output-links.md) point 2), raised before any file is processed.
5. **Library: `rebaseOutputLinks?: boolean | string | undefined` on `FileInjectorOptions`.** `true` is the no-value form, and a string is the URL base, validated as in points 2–4.
6. **One base for links and images.** There's no separate image base for now. Whether GitHub displays a `blob/` URL as an image is unverified ([ADR-0003](0003-rebase-base-resolution.md) Consequences). A separate image base is future work, to design once that behavior is known.
7. **Run-wide only.** There's no hash key or per-file control. The flag describes where the output tree lives, which is a property of the run, like `--output-dir`. A file that needs different handling can be processed in a separate run.
8. **Rollout: `feat:`, minor.** The flag is opt-in, so no existing output changes. Document it in the relative-links guide (`docs/guide/relative-links.md`) and add an `--output-dir` note to the README options, following CONTRIBUTING.md's "Documenting a new feature".

## Options Considered

- **Accept any absolute URL as the base.** Rejected per point 2. A `file:` base overlaps with the deferred directory form.
- **Use the base exactly as given.** Rejected per point 3. It would silently drop the last path segment of a base without a trailing slash.
- **`--rebase-output-images <url>`, a second base for images.** Deferred per point 6.
- **A directive-level opt-out** (`#rebase-output-links=false`). Rejected per point 7.

## Consequences

- A GitHub `blob/` base may leave images undisplayed in contexts that need image bytes. This is unverified, and the fix would be the future image base.
- Adding the directory form later means changing point 2's error into a second accepted form. Existing URL values keep their meaning.

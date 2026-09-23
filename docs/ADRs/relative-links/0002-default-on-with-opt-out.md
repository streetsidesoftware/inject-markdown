# ADR-0002: Rebasing is on by default, with per-directive and run-wide opt-out

**Status:** Accepted
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Today, a relative link in injected Markdown is almost always broken whenever the source file and the host file live in different directories ([ADR-0001](0001-rebase-scope.md)). The fix changes the output of existing documents, so we need to decide whether it applies automatically and how an author turns it off.

Boolean hash options already exist: `quote`, `vars`, `markdown` and `html-table` are parsed in `parseHashString` through `parseFlagValue` ([hash.ts](../../../src/util/hash.ts)). That function accepts `true`/`false` and the short forms `t`/`f`/`yes`/`no`/`y`/`n`. CLI flags with a `--no-` form (`--no-inject-only`, `--no-stop-on-errors`) are registered in [app.mts](../../../src/app.mts).

## Decision

1. **On by default.** Every Markdown injection (`@@inject`/`@@inject-start` against a Markdown file) rebases relative URLs as defined in [ADR-0001](0001-rebase-scope.md).
2. **Per-directive opt-out: `#rebase-links=false`.** A new hash key, `rebase-links`, is parsed with `parseFlagValue`, so every spelling `quote=` accepts works here too. `#rebase-links` or `#rebase-links=true` explicitly turns it on, which is useful to override the CLI flag below.
3. **Run-wide opt-out: `--no-rebase-links`.** A CLI flag, with a matching `rebaseLinks` field on `Options`/`FileInjectorOptions` (default `true`).
4. **Precedence: the directive wins.** A directive's explicit `rebase-links` value overrides the CLI setting. Without one, the CLI setting applies.

## Options Considered

- **Opt-in flag.** Rejected: it keeps the broken output as the default, so every author has to discover the flag.
- **On by default with no opt-out.** Rejected: an author who worked around the old behavior (for example, by writing source links relative to the host file) needs a way to keep those links.
- **Hash key only, or CLI flag only.** Rejected. A hash key alone can't switch a whole run back to the old behavior while migrating. A CLI flag alone can't exempt one directive.
- **A negative key such as `#keep-links`.** Rejected in favor of a positive key with a boolean value, matching `quote=` and the other flags.

## Consequences

- Existing documents whose injected Markdown contains relative links change on the next run. See [ADR-0006](0006-rollout.md) for how this is released.
- `parseHashString` gains one key, and `app.mts` gains one option, which must also be added to the `Options`/`FileInjectorOptions` interfaces (see [CLAUDE.md](../../../CLAUDE.md)).

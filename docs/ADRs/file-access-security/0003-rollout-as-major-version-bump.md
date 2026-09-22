# ADR-0003: Ship as a breaking change in the next major version

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

The injection-root boundary ([ADR-0001](0001-injection-root-boundary.md)) changes default behavior: a directive that reads successfully today (referencing a file outside `cwd`) fatally errors after this ships, with no action from the user beyond upgrading. `inject-markdown` is a published library (current version `5.0.3`) as well as a CLI, so this affects programmatic consumers too, not just command-line invocations.

## Decision

Ship the injection-root boundary as a semver-major release (`5.x` → `6.0.0`). No transitional opt-in period or deprecation warning — the boundary is enforced from the first release that contains it. Release notes/CHANGELOG call out the change explicitly and point at [`--allow-outside-root`](0002-injection-root-escape-hatch.md) for anyone who needs to keep an outside-root reference working.

## Options Considered

- **Opt-in flag now, default flips in a later major version** — rejected: this leaves the disclosure risk unmitigated by default for however long the transition period lasts, for exactly the class of user (someone who never reads the changelog of a docs-formatting tool) that the "secure by default" decision in ADR-0001 was meant to protect.

## Consequences

- Requires a major version bump (`5.x` → `6.0.0`) coordinated with this feature's release, not bundled into a patch/minor alongside unrelated changes.
- Release notes/migration guide must name `--allow-outside-root` as the mitigation for anyone who hits the new error after upgrading.

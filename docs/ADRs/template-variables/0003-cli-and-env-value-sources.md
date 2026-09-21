# ADR-0003: CLI and environment value sources

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Beyond directive-level sources ([ADR-0002](0002-directive-value-sources.md)), the feature request asks for run-wide sources: values supplied on the CLI command line, and environment variables. Environment variables need an allow-list for security: a directive is just text in a Markdown file, and anyone who can open a PR touching a processed file can add one (the same trust-boundary reasoning [file-access-security ADR-0001](../file-access-security/0001-injection-root-boundary.md) uses for local file reads) — an unrestricted `{@ env.AWS_SECRET_ACCESS_KEY @}` would exfiltrate whatever is in the invoking process's environment into generated output.

## Decision

1. **`--value <name>=<val>`**, repeatable (Commander accumulates into a map) — run-wide values available to any directive that opts in ([ADR-0002](0002-directive-value-sources.md)).
2. **`--values-file <path>`** — a JSON file (same JSON-only-for-v1 rule as the directive-level `values-file=`) of run-wide values, resolved relative to `--cwd`/the injection root rather than to any single document, since it isn't tied to one Markdown file the way a directive's `values-file=` is.
3. **`--allow-env <NAME>`**, repeatable — allow-lists specific environment variable names a directive may reference, mirroring `--allow-outside-root`'s repeatable-flag pattern from [file-access-security ADR-0002](../file-access-security/0002-injection-root-escape-hatch.md) exactly.
4. **`env.` namespace.** Allow-listed environment variables are exposed under a reserved `env.` prefix in placeholder names — `{@ env.VERSION @}` resolves `process.env.VERSION` when `VERSION` is allow-listed via `--allow-env`. `env.` is always reserved for this purpose: if a `values=`/`values-file=`/`--value`/`--values-file` entry happens to define a top-level key literally named `env`, it is simply unreachable under `{@ env.* @}` — an unlikely-in-practice edge case, not defended against further.
5. These sources are run-wide: identical for every file/directive processed in one invocation. There is no per-file CLI override.

## Options Considered

- **Directive-level `#env:NAME` opt-in instead of a CLI allow-list** — rejected: it would let any directive (i.e. anyone who can edit a processed Markdown file) request any environment variable, reopening exactly the exposure [file-access-security ADR-0001](../file-access-security/0001-injection-root-boundary.md)'s Context describes for file reads. The decision about which env vars are safe to expose belongs to whoever invokes the tool, not to directive text.
- **`--values-file` subject to the injection-root boundary** — rejected: unlike a directive's `values-file=`, this path is supplied directly on the command line by whoever runs the tool, not triggered by directive text in a processed document. The injection-root boundary exists to stop directive text from reaching arbitrary files, which doesn't apply to a path the operator typed themselves — same trust tier as `--cwd`/`--output-dir`/`--allow-outside-root`.
- **Allowing a user-defined `env` key to shadow the reserved namespace** — rejected: keeps `{@ env.X @}`'s meaning constant (always "OS environment variable") regardless of what else happens to be in scope, instead of depending on which sources are combined.

## Consequences

- `app.mts` needs three new options — repeatable `--value`, `--values-file`, repeatable `--allow-env` — each mirrored into `FileInjectorOptions`/`Options`, per this repo's existing convention that every CLI option is registered in both places.
- Reading `process.env` only for allow-listed names keeps the rest of the process environment (secrets, tokens, credentials) unreachable from directive text, consistent with the posture [file-access-security ADR-0001](../file-access-security/0001-injection-root-boundary.md) and [ADR-0002](../file-access-security/0002-injection-root-escape-hatch.md) established for local file access.
- New glossary terms: **`--value`**, **`--values-file`**, **`--allow-env`**, **`env.` namespace**.

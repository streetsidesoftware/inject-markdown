# ADR-0007: Environment variables and `env.`

**Status:** Accepted

## Why

**Goal:** a release changes a version in one place. In CI, that place is often an environment variable.

**Problem:** a directive is text in a Markdown file, and anyone who can open a pull request that touches a processed file can add one. Unrestricted access would let `{@ env.AWS_SECRET_ACCESS_KEY @}` copy a secret from the environment into generated output.

## Decision

1. **`--allow-env <NAME>`** allows one environment variable. It is repeatable. The library API takes the same list as `allowEnv`.
2. **`{@ env.NAME @}` reads an allowed variable.** It resolves to `process.env.NAME` when `NAME` is allowed and set. Otherwise it is unresolved.
3. **`env.` is reserved.** Any name that is `env` or starts with `env.` is answered from the environment, before any declaration is consulted. A declaration can't define or shadow it: a values file with a top-level `env` key is unreachable through `{@ env.* @}`.
4. **Exactly two segments.** `{@ env @}` and `{@ env.A.B @}` never resolve.
5. **Only the operator allows variables.** There is no directive option that allows one. An alias may target `env.NAME`, and the allow-list still applies; see [Aliases](0010-aliases.md).

## Consequences

- The rest of the environment, with its tokens and credentials, is unreachable from directive text.
- `{@ env.X @}` means the OS environment variable, whatever else is in scope.
- An allowed variable that isn't set is reported like any unresolved placeholder.

## Context

- `--allow-env` mirrors `--allow-outside-root`: a repeatable flag through which the person running the tool widens what directive text can reach. The reasoning is the trust boundary in [file-access-security](../file-access-security/README.md).
- The message for an unresolved `env.` name says no value source defines it. The message doesn't yet hint at `--allow-env`: #886.

## Rejected approaches

- A directive-level `#env:NAME` opt-in: anyone who can edit a processed file could request any variable.
- Letting a declared `env` key shadow the namespace: `{@ env.X @}` would mean different things depending on which sources are combined.

# ADR-0006: Run-wide values on the command line

**Status:** Accepted

## Why

**Goal:** a release changes a version in one place, and every injected copy updates on the next run. For maintainers running releases or CI, that place is often the command line.

**Problem:** with values only in directives, CI would have to edit documents to pass in a build's version or date.

## Decision

1. **`--value <name>=<val>`** sets one run-wide value. It splits at the first `=`. The name is trimmed and must not be empty; an empty name or a missing `=` stops the run with an error.
2. **`--values-file <[prefix:]path>`** loads a run-wide JSON values file. It takes the same `[prefix:]path` grammar as `values-file=` ([Values-file prefixes](0005-values-file-prefixes.md)). Paths are relative to `--cwd`.
3. **`--values-file` is not subject to the injection root.** The person running the tool typed the path, so it may point anywhere.
4. **Each option is repeatable, and the three value options keep their command-line order.** `--value`, `--values-file` and `--value-alias` ([Aliases](0010-aliases.md)) form one ordered list of declarations. How that order decides precedence is in [Declaration-order precedence](0008-declaration-order-precedence.md).
5. **Run-wide values are the same for every document in the run.** They are read once, and they reach only directives that opt in ([Opting a directive in](0002-opting-a-directive-in.md)). There are no per-file values on the command line.
6. **The library API takes the same declarations as `valueDeclarations`.** It is an ordered list of `{ kind: 'value', name, value }`, `{ kind: 'values-file', path, prefix }` and `{ kind: 'alias', name, target }`. A later entry wins, and a directive's own declarations win over all of them. Values-file paths are relative to `cwd`, and may point outside the injection root. A `prefix` is `''` for the root or a dotted placeholder name; anything else throws an `OptionError`. `allowEnv` and `strictVars` are the equivalents of `--allow-env` and `--strict-vars`.

## Consequences

- CI can pass a build's version or date without touching documents: `--value version=1.2.3` or `--values-file package.json`.
- A directive can still override a run-wide value, because its own declarations are newer.
- A mistake in run-wide input fails the whole run, because it's the operator's input.
- An API caller passes a prefix as a field, so the drive-letter rule doesn't apply there. A one-character prefix such as `c` is accepted.

## Context

- The feature request asked for values on the command line, and for environment variables. Environment variables are in [Environment variables and `env.`](0007-environment-variables.md).
- `--values-file` first took one path, like `values-file=`. It became repeatable with the same prefix grammar for the same reason: values commonly come from more than one file.
- Commander collects each option separately. Keeping argv order across three options needs one shared collector.
- `--value` isn't trimmed yet, unlike the directive form: #885.

## Rejected approaches

- `--values-file` inside the injection root: the boundary stops directive text from reaching files, which doesn't apply to a path the operator typed.
- Per-file values on the command line: out of scope. A directive is the place for values that differ per document.
- A single `--values-file`: it can't combine files.

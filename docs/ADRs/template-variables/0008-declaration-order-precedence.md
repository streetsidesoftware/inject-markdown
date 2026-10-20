# ADR-0008: Declaration-order precedence

**Status:** Accepted

## Why

**Goal:** each directive alone tells you which values it gets. When several declarations define the same name, the reader has to be able to tell which one wins from the text.

**Problem:** a name can be defined by inline values, values files, aliases and the command line at once. Without one rule, the answer depends on details the reader can't see.

## Decision

1. **Newest declaration wins.** Value declarations form one sequence in the order they are written, oldest to newest. A declaration is a `values=` pair, a `value=`, a `values-file=` entry, a `value-alias=` pair, or the command-line equivalent. A newer declaration overrides an older one, whichever option it came from. The kind of declaration carries no rank of its own.
2. **Command-line declarations are older than the directive's.** The run-wide sequence comes first, and each directive's sequence follows it. A directive overrides the command line: `--value version=2.0` with `#values=version:1.0` gives `1.0`.
3. **Command-line flags keep their argv order.** `--value`, `--values-file` and `--value-alias` form one sequence. With `--values-file :a.json --value version=1.0 --values-file :b.json`, `b.json` wins for `version`.
4. **A directive reads left to right.** In `#values-file=:package.json&values=version:0.0.0-dev&values-file=:release.json`, `release.json` wins for `version`.
5. **Resolution is still per leaf.** The newest declaration that holds the exact name as a value wins; one that lacks it, or holds an object there, doesn't hide older ones. See [Per-leaf layered resolution and `null`](0009-per-leaf-layered-resolution.md).
6. **An alias is a declaration in the same sequence.** For a given name, whichever is newer decides it: an alias for the name, or a declaration holding a value for it. See [Aliases](0010-aliases.md).
7. **The `env.` namespace is outside the sequence.** It is answered before any declaration; see [Environment variables and `env.`](0007-environment-variables.md).

## Consequences

- A directive's text is one ordered list, and its order is the whole rule. A reader doesn't need to know which option outranks which.
- Command-line values act as run-wide defaults that any directive can override.
- CI can't override a value a directive hard-codes. To let it, the directive leaves the value out.

## Context

- Ranking by kind of source (directive `values=` over directive `values-file=` over `--value` over `--values-file`, with aliases above the values of their scope) assumes each option appears once per directive.
- Ranking by source type contradicts the order a reader sees once options can repeat. With `values=` and `values-file=` interleaved, the order would count only within each option. In the example in rule 4, an author reading left to right expects `release.json` to win, and a type ranking gives `0.0.0-dev`.
- Version 6.0.0 released the type ranking, and declaration order replaced it in 6.x as a fix, with a release-notes entry. The ranking was a defect in a feature released the same day, not a contract users relied on, so it didn't warrant a major version.
- Directive over command line is deliberate. The feature request framed values as "determined by the directive", and a directive read alone should mean what it says.

## Rejected approaches

- Ranking by kind of source (inline over file over command line): it contradicts reading order once options repeat.
- Deep-merging declarations oldest to newest into one tree: a newer scalar at `package` would erase every `package.*` leaf an older file supplied.
- The command line newer than the directive: CI could override a directive, but the directive's text would no longer say what it produces.
- Declaration order in the directive and ranking by kind on the command line: two rules for the same three kinds of entry.
- Aliases ranked above values in their scope: one exception to "newest wins" that the text doesn't show.
- Rejecting conflicting definitions as an error: a new error class for a feature meant to stay simple.
- Releasing the change as a breaking 7.0.0: a major version for a defect in a day-old feature costs more than it protects.
- Warning when the type ranking and declaration order disagree: a second resolver kept alive for almost no users.

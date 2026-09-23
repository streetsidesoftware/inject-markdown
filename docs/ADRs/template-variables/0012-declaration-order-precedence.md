# ADR-0012: Declaration-order value precedence

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0004](0004-value-source-precedence.md) ranks value sources by _type_: every directive `values=` pair outranks every directive `values-file=` entry, which outranks CLI `--value`, then `--values-file`. [ADR-0010](0010-value-alias.md) point 3 slots aliases into the same type ranking. `buildValueTiers` ([placeholderValues.ts](../../../src/FileInjector/placeholderValues.ts)) implements that as fixed tiers.

The type ranking rested on an assumption that each option appears once per directive. [ADR-0011](0011-repeated-hash-keys.md) made `values=`, `values-file=` and `value-alias=` accumulate across repeats, so a directive can now interleave them:

```
#values-file=:package.json&values=version:0.0.0-dev&values-file=:release.json
```

An author reading left to right expects `release.json` — declared last — to win for `version`. The type ranking gives `0.0.0-dev`, because every `values=` pair outranks every `values-file=` entry regardless of position. Within one type the rule is already last-listed-wins ([ADR-0007](0007-values-file-prefixing.md) point 6), so the directive's text reads as one ordered list whose order only partly counts.

## Decision

1. **Newest declaration wins.** Value declarations form one sequence in the order they are written, oldest to newest. A newer declaration overrides an older one regardless of which option it came from; the source type carries no rank of its own.
2. **Per-leaf resolution is kept.** Each declaration is still a [value layer](../../glossary.md#value-layer) ([ADR-0008](0008-value-layering-and-resolution.md) point 1), and a name resolves against the first layer, newest first, that holds it as a scalar. Only the ordering of the layers changes. In `values-file=:package.json&values=package:x`, `{@ package @}` is `x` and `{@ package.version @}` still resolves from `package.json`.
3. **CLI declarations are older than directive declarations.** The run-wide sequence comes first and each directive's sequence is appended after it, so a directive overrides the CLI. `--value version=2.0` with `#values=version:1.0` yields `1.0`. This keeps [ADR-0004](0004-value-source-precedence.md)'s directive-over-CLI rule: a directive read in isolation means what it says, and CLI values act as run-wide defaults.
4. **CLI flags keep their command-line order.** `--value`, `--values-file` and `--value-alias` form one sequence in argv order. With `--values-file :a.json --value version=1.0 --values-file :b.json`, `b.json` wins for `version`.
5. **Aliases are declarations in the same sequence.** An alias has no tier of its own. For a given name, whichever is newest — an alias for it or a layer holding it as a scalar — decides it. In `#values=version:1.0&value-alias=version:release.version`, the alias applies; reversed, `1.0` does.
   - The alias's _target_ still resolves lazily against the whole sequence ([ADR-0010](0010-value-alias.md) point 4), so a values file declared after the alias can satisfy it.
   - An alias that decides a name and whose target does not resolve leaves the placeholder unresolved; resolution does not fall back to older layers for the name ([ADR-0010](0010-value-alias.md) point 9). Cycles are reported as before (point 5).
6. **The `env.` namespace stays outside the sequence.** It is still answered before any declaration is consulted ([ADR-0003](0003-cli-and-env-value-sources.md) point 4), so no declaration can define or shadow `env.*`. Earlier ADRs listed it last in the order; it was never ranked, and this ADR stops describing it as if it were.
7. **Released as a fix in 6.x.** Template variables shipped in 6.0.0 on the same day this was decided. The type ranking is treated as a defect in the released order, not a contract, so this ships as `fix:` with no transition warning and a release-notes entry calling out the changed order.

## Options Considered

- **Keep the type ranking** — rejected: with repeated keys ([ADR-0011](0011-repeated-hash-keys.md)) the directive text is an ordered list, and ranking by type makes its order matter only within each type, which is invisible when reading it.
- **Deep-merge declarations oldest to newest into one tree** (objects merge, a scalar or array replaces) — rejected: a newer scalar at `package` would erase every `package.*` leaf an older file supplied, reintroducing the data loss [ADR-0008](0008-value-layering-and-resolution.md) removed. Keeping per-leaf lookup changes only the order, not the resolution rule.
- **CLI declarations newer than the directive** — rejected: lets CI override a hard-coded directive value, but then a directive's text no longer tells a reader what it produces. [ADR-0004](0004-value-source-precedence.md) rejected global-over-directive for the same reason.
- **Declaration order in the directive, type ranking on the CLI** — rejected: two rules for the same three kinds of entry. Commander collects each option separately, so argv order costs a shared collector, which is small.
- **Aliases keep outranking values in their scope** ([ADR-0010](0010-value-alias.md) point 3) — rejected: it leaves one exception to "newest wins" that the directive text doesn't show.
- **Releasing as a breaking change (7.0.0)** — rejected: strict semver, but a major version for a same-day correction of a new feature costs more than it protects.
- **Warning when the old and new orders disagree** — rejected: it needs a second resolver kept alive just to compare, for a window of users that is at most a day old.

## Consequences

- Supersedes [ADR-0004](0004-value-source-precedence.md) (its type ranking), [ADR-0010](0010-value-alias.md) point 3 (the alias tier), and the source-order half of [ADR-0008](0008-value-layering-and-resolution.md) point 2 and [ADR-0011](0011-repeated-hash-keys.md) point 3. ADR-0008's per-leaf rule and [ADR-0007](0007-values-file-prefixing.md) point 6's last-listed-wins are kept; the latter now holds across all value options rather than within one.
- `buildValueTiers` stops grouping layers by type. The hash parser has to keep declarations in one ordered list instead of per-option fields; merging `values=` pairs into a `Map` (`mergePairs`) loses position, because `Map.set` on an existing key keeps its original slot.
- `app.mts` needs one shared argv-order collector for `--value`, `--values-file` and `--value-alias` instead of three independent arrays.
- The resolver walks one newest-first list mixing alias entries and value layers, and no longer uses fixed tiers.
- New glossary terms: **Value declaration**, **Declaration order**; **Value source precedence** is redefined.

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

## Options Considered

- **Keep the type ranking** — rejected: with repeated keys ([ADR-0011](0011-repeated-hash-keys.md)) the directive text is an ordered list, and ranking by type makes its order matter only within each type, which is invisible when reading it.
- **Deep-merge declarations oldest to newest into one tree** (objects merge, a scalar or array replaces) — rejected: a newer scalar at `package` would erase every `package.*` leaf an older file supplied, reintroducing the data loss [ADR-0008](0008-value-layering-and-resolution.md) removed. Keeping per-leaf lookup changes only the order, not the resolution rule.

## Consequences

- [ADR-0004](0004-value-source-precedence.md)'s type ranking and [ADR-0010](0010-value-alias.md) point 3 are superseded by this ADR once it is accepted.
- `buildValueTiers` stops grouping layers by type; the hash parser has to keep declarations in one ordered list instead of per-option fields.

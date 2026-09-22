# ADR-0011: Repeated directive hash keys

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

A directive's options are a URL hash, parsed by `parseHashString` ([hash.ts](../../../src/util/hash.ts)) with `URLSearchParams`. That iterator yields every occurrence of a repeated key, but the switch that follows _assigns_:

```ts
case 'values-file':
    info.valuesFile = parseValuesFileList(value);
    continue;
```

So a directive written with the key twice keeps only the last one, and the first is discarded with no warning:

```
#values-file=:./package.json&values-file=release:releases.json
```

resolves `release.*` and silently drops `package.json` entirely — every name it would have supplied is simply unresolved. The equivalent comma list, `values-file=:./package.json,release:releases.json`, is the documented syntax ([ADR-0007](0007-values-file-prefixing.md) point 1) and works correctly, so the two forms disagree with no indication which one the author got.

This is the same class of defect [ADR-0008](0008-value-layering-and-resolution.md) removed one level down: a second entry silently erasing the first. Repeating a key is also the natural way to write a list when an entry contains a comma, which otherwise needs whole-value quoting.

`parseHashString` already accumulates every repeated key into `info.params` via its `addParam` helper, so the raw occurrences are not lost — only the typed fields discard them.

## Decision

1. **The three list-valued options accumulate.** `values=`, `values-file=` and `value-alias=` gather every occurrence, in document order, exactly as if their contents had been written as one comma-separated list. `#values-file=a.json&values-file=b.json` is identical to `#values-file=a.json,b.json`.
2. **Every other key keeps last-wins, silently.** `heading`, `code`/`lang`, `quote`, `vars`, `lines`/`line` and a bare `L1-L10` range each hold one value; a repeat replaces, as today. No warning: it matches the last-wins rule used everywhere else in this feature, and it stays quiet on directives that already work.
3. **Collision rules are unchanged.** [ADR-0007](0007-values-file-prefixing.md) point 6's last-listed-wins applies across the flattened sequence, and [ADR-0008](0008-value-layering-and-resolution.md) point 2's layer order follows it — accumulating changes only how the list is spelled, never how its entries resolve.
4. **Both spellings are documented as equals.** Neither is deprecated. Repeating the key is the way to write an entry containing a literal comma without whole-value quoting ([ADR-0002](0002-directive-value-sources.md) point 1); the comma list stays the compact form for short lists.

## Options Considered

- **Accumulating line ranges too**, so `#L1-L10&L20-L30` injects two spans — rejected as a different feature rather than repeated-key support. `InjectInfo.lines` holds a single `Range`, and `extractLines` would have to splice several spans and decide what separates them in the output. Worth its own ADR if multi-range injection is ever wanted.
- **Warning on a repeated scalar key** (`#heading=A&heading=B`) — rejected: writing the same scalar twice is usually a mistake, but a warning would fire on directives that work today and read correctly, and last-wins is what every other repeated thing in this feature does.
- **Making a repeated scalar key a directive error** — rejected for the same reason, more so: it converts working directives into failures, and is harsher than anything else here.
- **Deprecating the comma list** in favor of repeated keys — rejected: the comma list is what [ADR-0002](0002-directive-value-sources.md) and [ADR-0007](0007-values-file-prefixing.md) already specify and what the fixtures use, and it stays the more compact form.
- **Leaving the behavior as it is** and documenting that a repeated key keeps the last — rejected: the form is a natural thing to write, it silently discards whole files, and nothing in the output says so.

## Consequences

- `parseHashString` merges rather than assigns for the three list keys. `values=` and `value-alias=` produce `Map`s, so merging sets keys in order and a repeated _name_ last-wins, which is already the behavior within one occurrence; `values-file=` concatenates entry arrays.
- No other parsing changes: the accumulated result is the same shape each option already produces, so `FileInjector` and the resolver are untouched.
- A directive that currently relies on a repeated key discarding earlier occurrences changes behavior. Nothing in the repository does, the feature is new in this release, and the old behavior lost data rather than expressing intent.
- Multi-range injection stays unavailable, now explicitly rather than by omission.

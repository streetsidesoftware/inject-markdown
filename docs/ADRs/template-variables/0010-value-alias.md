# ADR-0010: `value-alias=` — redefining a name to point at another

**Status:** Accepted; point 3 superseded by [ADR-0012](0012-declaration-order-precedence.md)
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

Namespacing from [ADR-0007](0007-values-file-prefixing.md) makes every values file addressable but also makes real names long: a release manifest loaded as `values-file=release:releases.json` is read as `{@ release.latest.version @}` everywhere it appears. [ADR-0009](0009-prefix-grammar-and-drive-letters.md) tightens this further by removing single-character prefixes, so the shortest a namespace can be is two characters.

There is no way to say "in this document, `version` means that". The sources available all supply _values_ ([ADR-0002](0002-directive-value-sources.md), [ADR-0003](0003-cli-and-env-value-sources.md)); none supplies a _name_. Copying the value with `values=version:1.2.3` duplicates it and goes stale; root-merging the file (`:releases.json`) drops the namespace for every one of its keys, not just the one wanted, and collides with whatever else is merged at the root.

The motivating shape is a directive that loads two files and wants one name from the second to win:

```
<!--- @@inject: notes.md#values-file=:./package.json&values-file=release:releases.json&value-alias=version:release.latest.version --->
```

`package.json` is root-merged, so it already defines `version`. The alias has to redefine it.

## Decision

1. **Grammar.** A directive option `value-alias=new:target[,new2:target2...]`, using the same comma-separated `name:value` shape as `values=` ([ADR-0002](0002-directive-value-sources.md) point 1), and a repeatable CLI option `--value-alias <new>=<target>`, using the same `name=value` shape as `--value` ([ADR-0003](0003-cli-and-env-value-sources.md) point 1). Singular `value-alias`, because each entry aliases one name.
2. **Both sides are placeholder names.** New name and target both follow the dotted grammar of [ADR-0001](0001-placeholder-syntax.md), so `--value-alias build.version=release.latest.version` is allowed and `{@ build.version @}` resolves through it.
3. **An alias outranks the values in its own tier.** Resolution order becomes:
   1. directive `value-alias=`
   2. directive `values=`
   3. directive `values-file=`
   4. CLI `--value-alias`
   5. CLI `--value`
   6. CLI `--values-file`
   7. the `env.` namespace

   A directive alias therefore redefines a name the same directive's own `values-file=` supplies — which is what the Context example needs — while a CLI alias never overrides anything the directive said. This extends [ADR-0004](0004-value-source-precedence.md) rather than replacing it: the directive-over-CLI ordering is unchanged, and an alias is simply the most specific thing a given tier can say about a name.

4. **Resolution is by rewriting, lazily.** An alias does not hold a value and is not a [value layer](../../glossary.md#value-layer) ([ADR-0008](0008-value-layering-and-resolution.md)). Resolving `new` means resolving `target` through the normal layer walk at that moment, so an alias always reflects whatever the layers currently say.
5. **Chains follow; cycles are reported.** If a target is itself an aliased name, resolution follows through. A name repeating on the path is a cycle: the placeholder is unresolved and the message names the cycle, rather than looping.
6. **A target may be any name, including `env.`** — `--value-alias token=env.DEPLOY_TOKEN` resolves through the reserved namespace and so remains subject to `--allow-env` ([ADR-0003](0003-cli-and-env-value-sources.md) point 4). The alias is indirection over the same resolver, so the allow-list is enforced without a second rule.
7. **Last-listed wins** on a repeated new name, within a `value-alias=` list and across repeated `--value-alias` flags alike, matching [ADR-0007](0007-values-file-prefixing.md) point 6.
8. **`value-alias=` opts a directive in**, alongside `values=`, `values-file=` and bare `vars` ([ADR-0002](0002-directive-value-sources.md) point 4).
9. **An alias whose target does not resolve leaves the placeholder unresolved**, and the message names both sides so the author can tell which end is wrong — the alias points somewhere, and that somewhere is empty. This is a third message alongside [ADR-0005](0005-unresolved-placeholders-and-strict-mode.md) point 4's two.

## Options Considered

- **An alias only fills a gap** (it applies when nothing else defines the name) — rejected: the Context example is precisely a name that _is_ already defined, by the root-merged `package.json`, and redefining it is the point.
- **An alias always rewrites, ahead of every tier** — rejected: a CLI `--value-alias` would then silently override a directive's own inline `values=`, inverting the directive-over-CLI rule [ADR-0004](0004-value-source-precedence.md) exists to state.
- **One hop, no chaining** — rejected: it makes an alias over an aliased name fail silently, which is hard to see in a directive that reads perfectly well. Cycle detection is a visited set in the resolver, which is cheap next to that.
- **Restricting the new name to a single segment** — rejected as an exception to the naming grammar that authors would have to remember, for no gain; a dotted new name is just another namespace.
- **Excluding `env.` as a target** — rejected: it would need a special case in the alias rule, and the allow-list already decides what is reachable, so nothing is gained by blocking the indirection.
- **Plural `values-alias=`**, grouping visually with `values=`/`values-file=` — rejected: each entry maps exactly one name to one name, so the plural would be inaccurate.
- **Copying the value instead** (`values=version:1.2.3`) — the status quo, and the thing this replaces: it duplicates a value that already exists in a file the directive is loading anyway, and nothing keeps the copy honest.

## Consequences

- `InjectInfo` gains `valueAlias`, `app.mts` gains `--value-alias`, and `Options`/`FileInjectorOptions` gain the matching field, per this repo's convention that every CLI option is registered in both places.
- The resolver stops being a plain walk over layers: a lookup first consults the alias table for its tier, in the order of point 3, and recurses on a hit. The unresolved reporting from [ADR-0008](0008-value-layering-and-resolution.md) has to carry the alias and its target so point 9's message can name both.
- Aliases are collected per tier rather than merged into one table, since point 3 ranks a directive alias above a CLI one.
- `--strict-vars` applies unchanged: an unresolved alias, including a cycle, becomes a directive error.
- Because resolution is lazy (point 4), an alias may be declared before the values file that satisfies it is listed; order within the directive does not matter for correctness, only for point 7's collisions.
- New glossary terms: **Value alias**, **`value-alias=` option**, **`--value-alias`**.

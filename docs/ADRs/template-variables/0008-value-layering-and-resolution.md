# ADR-0008: Value layering and per-leaf resolution

**Status:** Accepted; point 2's source order superseded by [ADR-0012](0012-declaration-order-precedence.md)
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

[ADR-0004](0004-value-source-precedence.md) fixes the order in which value _sources_ are consulted, and [ADR-0007](0007-values-file-prefixing.md) point 6 says a later `values-file=`/`--values-file` entry wins over an earlier one on a prefix collision. Neither says what "wins" means when the collision is partial — when two sources each define _part_ of the same dotted namespace.

The implementation answers that question three different ways, which a review of the feature surfaced before it shipped:

- **Across sources** it already falls through per leaf, because `getPath` returns `undefined` for a missing leaf and `buildResolver` then tries the next source. `--values-file package.json --value package.engines.node=26.0` correctly yields `26.0` for `package.engines.node` while `package.engines.npm` and `package.version` still come from `package.json`.
- **Within one values-file list** it replaces wholesale: `buildValuesFileTree` does `tree[prefix] = data`, so `--values-file p:a.json --values-file p:b.json` discards everything in `a.json`, including keys `b.json` never mentions.
- **Within a root merge** it is shallow: `mergeRoot` assigns top-level keys only, so `:a.json` + `:b.json` keeps a key `a.json` alone defines, but loses `a.json`'s `engines.node` as soon as `b.json` also has an `engines` object.

ADR-0004's own Consequences paragraph describes the second behavior ("a name either comes entirely from one source's value tree or falls through to the next source, never a blend of two") while the code implements the first. The same inconsistency reaches `--value`: `treeFromFlatMap` folds every `--value` flag into one tree via `setPath`, so `--value a=1 --value a.b=2` loses `a` entirely rather than letting both names resolve.

This ADR replaces all three with one rule.

## Decision

1. **Every assignment is a layer.** A layer is the smallest unit that supplies values: one `name:value` pair from a directive's `values=`, one `--value` flag, one `values-file=` entry, one `--values-file` entry. Sources are never folded into a shared tree, so no assignment can destroy another by being written over it.
2. **Layers are ordered by precedence.** [ADR-0004](0004-value-source-precedence.md)'s source order still governs: directive `values=` > directive `values-file=` > CLI `--value` > CLI `--values-file` > the `env.` namespace. Within one source, a later-listed entry sits _above_ an earlier one, which is how [ADR-0007](0007-values-file-prefixing.md) point 6's last-listed-wins rule is honored — now at leaf granularity rather than wholesale.
3. **Resolution is per leaf.** A placeholder name resolves against each layer in order and takes the first layer that holds that exact name as a scalar. A layer that lacks the name, or holds a non-scalar (object or array) or `null` at it, does not stop the search — the next layer is tried. This makes partial overrides work in every direction: a single `--value package.engines.node=26.0` patches one leaf of a values file without hiding its siblings, and two values files sharing a prefix contribute the union of their leaves.
4. **`null` is absent.** A JSON `null` behaves as "this layer does not define the name", not as a value and not as a stop. It neither substitutes as empty text nor blocks a lower layer.
5. **Nothing is merged structurally.** There is no combined value tree at any point; "merge" describes only the observable result of walking layers. Arrays are therefore never merged, indexed, or concatenated — an array is simply a non-scalar that resolution walks past, consistent with this feature's scope (no array indexing).

## Options Considered

- **Deep-merging all layers into one tree** (objects merge recursively, scalars and arrays replace) — produces the same answers for every case above, and would make a future `--print-values` dump trivial because there would be a single materialized tree to print. Rejected for now: it requires specifying object-vs-scalar conflict handling as its own rule, and it re-opens the array question (merge, replace, or concatenate?) that layering avoids by construction. Worth revisiting if a values-dump/debugging option is ever added.
- **Keeping the current three behaviors** and documenting them accurately — rejected: the difference between "these two files share a prefix" and "these two sources share a prefix" is invisible in the directive text, so the wholesale-replace case reads as data loss rather than as a rule.
- **Layering per source entry rather than per assignment** (the whole `values=` option is one layer, all `--value` flags are one layer) — rejected: it fixes the values-file case but leaves `--value a=1 --value a.b=2` silently dropping `a`, reproducing the original bug one level down. Per-assignment layering costs nothing at this scale and removes the whole class.
- **Treating `null` as a blocking "explicitly undefined"** — rejected: it would give `null` a meaning distinct from both a missing key and a value, which is a third state authors would have to learn for no use case this feature has. Rejected too was rendering `null` as an empty string, which turns a likely typo into silently empty output where a warning would otherwise fire.
- **First-listed wins within a source**, mirroring the table feature's first-match rule — rejected in [ADR-0007](0007-values-file-prefixing.md) point 6 already; layering preserves that decision rather than revisiting it.

## Consequences

- `buildValuesFileTree` no longer returns one merged tree; it returns an ordered list of layers, and `mergeRoot` disappears — a root-merged entry is just a layer with no prefix. `treeFromFlatMap` likewise yields one layer per pair instead of one folded tree, so `setPath`'s "last write into a shared tree wins" behavior stops being observable.
- `buildResolver` walks a flat ordered layer list instead of five trees, and no longer returns early on a non-scalar hit. That fixes a second defect from the same review: an inherited or implicitly-created object at a name used to report the placeholder unresolved even when a lower-precedence source held a perfectly good scalar.
- The `env.` namespace keeps its reserved short-circuit from [ADR-0003](0003-cli-and-env-value-sources.md) point 4 and is not a layer: `{@ env.X @}` always means the OS environment, and a value source defining a top-level `env` key stays unreachable.
- Because there is no materialized tree, a future values-dump option would have to print layers in order rather than one resolved object. Recorded here so the tradeoff against deep merge is visible if that option is ever wanted.
- [ADR-0004](0004-value-source-precedence.md) needs its Consequences paragraph corrected; [ADR-0005](0005-unresolved-placeholders-and-strict-mode.md) needs `null` and the two unresolved cases folded in; [ADR-0007](0007-values-file-prefixing.md) point 6 needs "wins" defined as per-leaf.
- New glossary terms: **Value layer**, **Per-leaf resolution**.

# ADR-0009: Per-leaf layered resolution and `null`

**Status:** Accepted

## Why

**Goal:** each directive alone tells you which values it gets, so a name resolves the same way however its values were declared.

**Problem:** when two declarations each define part of the same dotted namespace, "the newer one overrides the older one" can mean it replaces the whole branch or only the names it defines. Losing names the newer one never mentions reads as data loss.

## Decision

1. **Every declaration that supplies values is a layer.** A layer is one `values=` pair, one `value=`, one `--value`, or one `values-file=` or `--values-file` entry. Layers are never combined into a shared tree, so no declaration can destroy another by being written over it.
2. **Layers are ordered newest first**, by [Declaration-order precedence](0008-declaration-order-precedence.md).
3. **A name resolves per leaf.** Resolution walks the declarations newest first and takes the first layer that holds that exact name as a scalar. A layer that lacks the name, or holds an object or array at it, doesn't stop the search.
   - Aliases are consulted in the same walk, in declaration order, but they aren't layers. An alias for exactly this name ends the walk: the name resolves through its target, or stays unresolved. Resolution doesn't continue to older layers. See [Aliases](0010-aliases.md).
4. **A scalar is a string, number or boolean.** It is substituted as `String(v)`, so JSON `1.0` becomes `1`, `22` becomes `22`, and `true` becomes `true`. A version that must keep `1.0` is written as a JSON string.
5. **`null` counts as absent.** A JSON `null` neither substitutes nor blocks an older layer.
6. **Nothing is merged structurally.** Arrays are never merged, indexed or concatenated. An array is a non-scalar that resolution walks past.
7. **Prototype names are never written.** A name with a `__proto__`, `constructor` or `prototype` segment is dropped when a `values=`, `value=` or `--value` pair would write it. Lookup reads only a layer's own keys, so `{@ toString @}` never reaches an inherited member.

## Consequences

- `--value package.engines.node=26.0` overrides one leaf of `package.json` and leaves `package.version` resolving from the file.
- Two files under the same prefix contribute the union of their leaves. The newer file overrides the older one only where both define a name.
- `--value a=1 --value a.b=2` keeps both names.
- There is no merged tree to print. An option that printed the resolved values would print the layers in order.

## Context

- Any rule other than per-leaf layers treats cases differently that look the same in directive text:
  - Two values files under one prefix, replaced wholesale, lose keys only the older file has.
  - Two root-merged files, merged only at the top level, let a newer `engines` object hide the older file's `engines.node`.
  - Every `--value` folded into one tree loses `a` in `--value a=1 --value a.b=2`.
- The difference between "two files share a prefix" and "two sources share a prefix" is invisible in directive text. One rule had to cover all of them.
- A non-scalar must not stop the search. An object created implicitly by a dotted name, such as `pkg` from `--value pkg.a=1`, would otherwise hide a scalar `pkg` that a file defines explicitly.
- Directive text is untrusted, and values are written into objects. A name such as `__proto__.x` must not reach `Object.prototype`.

## Rejected approaches

- Deep-merging all layers into one tree: it needs its own object-versus-scalar rule and reopens the array question. Worth revisiting if a values-dump option is added.
- Documenting the three old behaviors: the wholesale replace still reads as data loss.
- One layer per option rather than per declaration: `--value a=1 --value a.b=2` would still lose `a`.
- `null` as "explicitly undefined" that blocks older layers: a third state with no use case.
- `null` as an empty string: a likely typo would become silently empty output.
- A non-scalar as a final answer: an implicitly created object would mask an explicit scalar.

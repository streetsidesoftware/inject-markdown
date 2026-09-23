# ADR-0004: Value source precedence and combination

**Status:** Superseded by [ADR-0012](0012-declaration-order-precedence.md)
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

A placeholder name can be defined by more than one source at once: a directive's inline `values=`, its `values-file=`, CLI `--value`, CLI `--values-file`, or (in the `env.` namespace) an environment variable ([ADR-0002](0002-directive-value-sources.md), [ADR-0003](0003-cli-and-env-value-sources.md)). We need one deterministic rule for which value wins on a name collision, including the case where a single directive carries both `values=` and `values-file=` at once.

## Decision

Lookup order, most specific wins:

1. Directive inline `values=`
2. Directive `values-file=`
3. CLI `--value`
4. CLI `--values-file`
5. Environment (`env.` namespace only — not merged into the same flat space as 1–4; see [ADR-0003](0003-cli-and-env-value-sources.md) point 4)

[ADR-0010](0010-value-alias.md) point 3 extends this list with aliases, which rank above the values of their own tier — directive `value-alias=` above 1, CLI `--value-alias` above 3 — leaving the relative order of the ranks above unchanged.

A name resolves to the value from the first source in this list that defines it _as a scalar_. This is evaluated per lookup, not per directive as a whole: a directive can pull `version` from its own inline `values=` while falling through to CLI `--value` for `buildDate`, in the same content.

This order ranks _sources_. It does not by itself say what happens when two sources each define part of the same dotted namespace, or when two entries within one source collide — [ADR-0008](0008-value-layering-and-resolution.md) settles that, and refines "the first source that defines it" into "the first layer that holds it as a scalar".

## Options Considered

- **Global (env/CLI) wins over directive-level** — rejected: conflicts with the feature request's own framing that "the values are determined by the directive"; it would let a CLI/env value silently override what a directive author wrote inline, surprising anyone reading the directive in isolation.
- **Reject on conflict instead of a fixed precedence order** — rejected: adds a new "ambiguous value" error class and forces every author combining sources to avoid any name overlap, for a feature whose explicit goal is staying simple rather than becoming a full template engine. A documented precedence order is easier to reason about than an error mode most users would rarely hit.
- **Deep-merging all sources into one lookup object** instead of trying sources in order — rejected: merging is ambiguous for nested dotted-path values from different sources (e.g. what does merging `values-file`'s `package: {version: "1.0"}` with CLI `--value package.name=x` even produce structurally?). Trying sources in order sidesteps that by never combining two sources' trees. [ADR-0008](0008-value-layering-and-resolution.md) reaches the same end result — a name can draw its siblings from a lower-precedence source — by walking layers per leaf rather than by materializing a merged object, and re-records this rejection with that framing.

## Consequences

- The resolver tries sources in order rather than doing one deep merge. Fall-through is per _leaf_, not per source: a name missing from a higher-precedence source is looked for in the next one, so `--values-file package.json --value package.engines.node=26.0` overrides exactly that one leaf and leaves `package.version` and `package.engines.npm` resolving from the file. See [ADR-0008](0008-value-layering-and-resolution.md).
- New glossary term: **Value source precedence**.

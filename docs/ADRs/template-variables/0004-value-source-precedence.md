# ADR-0004: Value source precedence and combination

**Status:** Accepted
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

A name resolves to the value from the first source in this list that defines it. This is evaluated per lookup, not per directive as a whole: a directive can pull `version` from its own inline `values=` while falling through to CLI `--value` for `buildDate`, in the same content.

## Options Considered

- **Global (env/CLI) wins over directive-level** — rejected: conflicts with the feature request's own framing that "the values are determined by the directive"; it would let a CLI/env value silently override what a directive author wrote inline, surprising anyone reading the directive in isolation.
- **Reject on conflict instead of a fixed precedence order** — rejected: adds a new "ambiguous value" error class and forces every author combining sources to avoid any name overlap, for a feature whose explicit goal is staying simple rather than becoming a full template engine. A documented precedence order is easier to reason about than an error mode most users would rarely hit.
- **Deep-merging all sources into one lookup object** instead of trying sources in order — rejected: merging is ambiguous for nested dotted-path values from different sources (e.g. what does merging `values-file`'s `package: {version: "1.0"}` with CLI `--value package.name=x` even produce structurally?). Precedence-by-whole-source sidesteps that by never combining two sources' trees for the same top-level name.

## Consequences

- The resolver tries sources in order and short-circuits on the first hit, rather than doing one deep merge — a name either comes entirely from one source's value tree or falls through to the next source, never a blend of two.
- New glossary term: **Value source precedence**.

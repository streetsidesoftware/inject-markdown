# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
- **Grouping:** when several ADRs decide facets of one feature/initiative (e.g. a batch of related options shipped together), put them in a subfolder named after the initiative (kebab-case, e.g. `table-improvements/`) with its own `README.md` index and its own `0001`-based numbering — this keeps a single feature's decisions together and stops the flat top-level list from growing noisy as unrelated ADRs accumulate over time. An ADR that doesn't belong to any such group stays flat directly in this directory, numbered in the top-level sequence.
- An ADR is immutable once its status moves to `Accepted`. If a decision changes later, write a new ADR that supersedes it (update the old ADR's `Status` to `Superseded by ADR-NNNN` and link both ways) rather than editing the original's Decision section.
- While a decision is still being worked out (as in an interview-driven design session), an ADR may carry `Status: Proposed` and be revised in place — treat it as settled once the related feature ships and flip it to `Accepted`.

## Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
**Date:** YYYY-MM-DD
**Deciders:** Names

## Context

## Decision

## Options Considered

## Consequences
```

## Groups

| Group | Description |
| --- | --- |
| [table-improvements/](table-improvements/) | `header-rows`, `columns`, row windowing, and auto-alignment options for table injection |

## Index (ungrouped ADRs)

_None yet — all current ADRs belong to the `table-improvements` group above._

See also: [glossary.md](../glossary.md).

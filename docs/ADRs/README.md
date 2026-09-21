# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
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

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-table-option-encoding-conventions.md) | Table option encoding conventions | Proposed |
| [0002](0002-table-header-rows-option.md) | `header-rows` option | Proposed |
| [0003](0003-table-columns-option.md) | `columns` option | Proposed |
| [0004](0004-table-row-window-options.md) | Row window options (`start-row`, `end-row`, `num-rows`) | Proposed |
| [0005](0005-table-auto-alignment.md) | Auto-alignment by content type | Proposed |

See also: [glossary.md](../glossary.md).

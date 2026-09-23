# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
- **Grouping:** when several ADRs decide facets of one feature/initiative (e.g. a batch of related options shipped together), put them in a subfolder named after the initiative (kebab-case, e.g. `table-improvements/`) with its own `README.md` index and its own `0001`-based numbering — this keeps a single feature's decisions together and stops the flat top-level list from growing noisy as unrelated ADRs accumulate over time. An ADR that doesn't belong to any such group stays flat directly in this directory, numbered in the top-level sequence.
- An ADR becomes immutable once it is on `main` together with a full implementation of what it decides. From then on, a changed decision means a new ADR that supersedes it (update the old ADR's `Status` to `Superseded by ADR-NNNN` and link both ways) rather than editing the original's Decision section.
- Until then — while a decision is still being worked out, or while it sits unmerged on a feature branch — an ADR is revised in place. Correct it rather than appending a note about what it used to say; the branch's commit history is the record of how it changed. Flip `Status: Proposed` to `Accepted` when the feature merges.

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

| Group                                          | Description                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [table-improvements/](table-improvements/)     | `header-rows`, `columns`, row windowing, auto-alignment, and Markdown-cell options for table injection |
| [file-access-security/](file-access-security/) | Boundary restricting which local files an `@@inject` directive may read                                |
| [template-variables/](template-variables/)     | `{@ name @}` placeholder substitution in injected content, values, sources, precedence                 |
| [security-hardening/](security-hardening/)     | Parser denial of service, discovery boundary, remote fetch policy, `--deny-access`, threat model       |

## Index (ungrouped ADRs)

_None yet — all current ADRs belong to a group above._

See also: [glossary.md](../glossary.md).

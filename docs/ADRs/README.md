# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
- **Grouping:** when several ADRs decide facets of one feature/initiative (e.g. a batch of related options shipped together), put them in a subfolder named after the initiative (kebab-case, e.g. `table-improvements/`) with its own `README.md` index and its own `0001`-based numbering — this keeps a single feature's decisions together and stops the flat top-level list from growing noisy as unrelated ADRs accumulate over time. An ADR that doesn't belong to any such group stays flat directly in this directory, numbered in the top-level sequence.
- **Accepting.** The PR that implements an ADR also changes its `Status` from `Proposed` to `Accepted`, and updates the status in its group's index table, so no follow-up PR is needed. An ADR is accepted once the feature it decides works on `main`. Points that apply only to an option that doesn't exist yet, such as how a later `columns=` matches header names, don't hold it back. A feature never waits on another feature.
- **After acceptance an ADR is immutable**, including any points still waiting on a later option. A changed decision means a new ADR that supersedes it rather than an edit to the original's Decision section. Link both ways and update the old ADR's `Status` to `Superseded by ADR-NNNN`, or to `Accepted; point N superseded by ADR-NNNN` when only some points change.
- **Before acceptance an ADR is revised in place**, while a decision is still being worked out or sits unmerged on a feature branch. Correct it rather than appending a note about what it used to say; the branch's commit history is the record of how it changed.

## Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Accepted; point N superseded by ADR-NNNN | Deprecated | Superseded by ADR-NNNN
**Date:** YYYY-MM-DD
**Deciders:** Names

## Context

## Decision

## Options Considered

## Consequences
```

## Groups

| Group                                          | Description                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [table-improvements/](table-improvements/)     | `header-rows`, `columns`, row windowing, auto-alignment, Markdown-cell, and JSON-source options for table injection                       |
| [file-access-security/](file-access-security/) | Boundary restricting which local files an `@@inject` directive may read                                                                   |
| [template-variables/](template-variables/)     | `{@ name @}` placeholder substitution in injected content, values, sources, precedence                                                    |
| [security-hardening/](security-hardening/)     | Parser denial of service, discovery boundary, remote fetch policy, `--deny-access`, threat model                                          |
| [relative-links/](relative-links/)             | Rebasing relative URLs in Markdown links, images, and definitions: in injected content, and onto `--output-dir` (`--rebase-output-links`) |

## Index (ungrouped ADRs)

_None yet — all current ADRs belong to a group above._

See also: [glossary.md](../glossary.md).

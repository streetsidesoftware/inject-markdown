# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Purpose

ADRs are a tool for designing a feature well. The goal is a well-designed feature, not the ADRs.

They help us work through a design one decision at a time. Later, they show others how we got there and what we thought mattered. They record how the feature was designed. They aren't a contract: when building or using the feature shows a better answer, change the design.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
- **Grouping:** when several ADRs decide facets of one feature/initiative (e.g. a batch of related options shipped together), put them in a subfolder named after the initiative (kebab-case, e.g. `table-improvements/`) with its own `README.md` index and its own `0001`-based numbering — this keeps a single feature's decisions together and stops the flat top-level list from growing noisy as unrelated ADRs accumulate over time. An ADR that doesn't belong to any such group stays flat directly in this directory, numbered in the top-level sequence.
- **Accepting.** The PR that implements an ADR also changes its `Status` from `Proposed` to `Accepted`, and updates the status in its group's index table, so no follow-up PR is needed. An ADR is accepted once the feature it decides works on `main`. Points that apply only to an option that doesn't exist yet, such as how a later `columns=` matches header names, don't hold it back. A feature never waits on another feature.
- **An ADR is revised in place**, before and after acceptance. When building or using a feature shows a better answer, change the design, and update its ADR in the same PR: state the current decision, move the old choice into Options Considered with what changed and why. The earlier version stays in git history. If a decision is replaced outright, write a new ADR and mark the old one `Superseded by ADR-NNNN`.

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

## Glossaries

- A term introduced by one feature's ADRs goes in the [ADR glossary](glossary.md).
- A concept used across the repo goes in the main [glossary](../glossary.md).
- A term that becomes repo-wide moves from the ADR glossary to the main one, and links to it are updated.

Both glossaries use the same entry format:

```markdown
### <Term>

<Definition.> From [<feature>](<feature>/README.md).
```

- Link to the feature's `README.md`, never to a single ADR. From the main glossary the link is `ADRs/<feature>/README.md`.
- Keep entries sorted alphabetically, ignoring case, backticks and leading `--` (`--allow-env` sorts under A).
- When a term is renamed or moved, update every link to its old anchor.

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

See also: [glossary](../glossary.md), [ADR glossary](glossary.md).

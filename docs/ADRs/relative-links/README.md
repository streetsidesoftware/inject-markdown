# Relative links

ADRs for rebasing relative URLs in injected Markdown, so a link written relative to the source file still resolves after the content is copied into a host file in another directory. Numbering restarts at `0001` within this group; see [../README.md](../README.md) for the overall ADR convention.

| ADR                                     | Title                                                                      | Status   |
| --------------------------------------- | -------------------------------------------------------------------------- | -------- |
| [0001](0001-rebase-scope.md)            | What gets rebased: constructs and URL forms                                | Proposed |
| [0002](0002-default-on-with-opt-out.md) | Rebasing is on by default, with per-directive and run-wide opt-out         | Proposed |
| [0003](0003-rebase-base-resolution.md)  | Resolving a rebased URL: local sources, remote sources, and `--output-dir` | Proposed |
| [0004](0004-rebased-path-format.md)     | Format of a rebased path                                                   | Proposed |
| [0005](0005-interactions.md)            | Interaction with other injection options                                   | Proposed |
| [0006](0006-rollout.md)                 | Rollout as a minor release                                                 | Proposed |
| [0007](0007-rebase-output-links.md)     | `--rebase-output-links [base]`: rebase links onto the output location      | Proposed |
| [0008](0008-output-link-semantics.md)   | How `--rebase-output-links` interprets a link                              | Proposed |
| [0009](0009-output-rebase-mechanics.md) | Mechanics of output rebasing                                               | Proposed |
| [0010](0010-output-rebase-surface.md)   | `--rebase-output-links` surface, validation, and rollout                   | Proposed |

## Future work

Not decided yet. Each needs its own ADR in this group. ADR-0007 to ADR-0010 are designed but not implemented.

- **Rewrite links in raw HTML.** `<img src>`, `<a href>`, `srcset` and similar attributes inside `html` nodes, deferred by [ADR-0001](0001-rebase-scope.md) point 2.
- **A directory base for `--rebase-output-links`**, meaning "the source tree is published at `<dir>`". Deferred by [ADR-0007](0007-rebase-output-links.md) until there's a concrete use case.
- **A separate image base** (e.g. `raw.githubusercontent.com`) for `--rebase-output-links`. Deferred by [ADR-0010](0010-output-rebase-surface.md) point 6 until it's known whether GitHub displays `blob/` URLs as images.

See also: [../../glossary.md](../../glossary.md).

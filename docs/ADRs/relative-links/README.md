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

See also: [../../glossary.md](../../glossary.md).

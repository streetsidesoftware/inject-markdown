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

## Future work

Not decided yet. Each needs its own ADR in this group.

- **Rewrite links in raw HTML.** `<img src>`, `<a href>`, `srcset` and similar attributes inside `html` nodes, deferred by [ADR-0001](0001-rebase-scope.md) point 2.
- **Rebase links to the output location: `--rebase-output-links [dir|url]`.** An opt-in flag that rebases every relative link in the written file, not only injected ones, onto the `--output-dir` location or an optional base. It revisits [ADR-0003](0003-rebase-base-resolution.md) point 3 for runs that set it. Open questions:
  - It rewrites the host file's own links, which conflicts with `--inject-only` (the default), since that mode only patches injected spans.
  - A directory base keeps links working from the output location. A URL base (e.g. `https://github.com/o/r/blob/main/`) makes every relative link absolute, as a README published to npm needs.

See also: [../../glossary.md](../../glossary.md).

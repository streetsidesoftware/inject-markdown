# File access security

ADRs for restricting which local files an `@@inject` directive may read, so a directive in a processed Markdown file can't be used to disclose files outside the intended project tree (e.g. `.env`, SSH keys) into generated output. Scoped to local (`file:`) reads only — remote `http(s)` fetches are unaffected by this group. Numbering restarts at `0001` within this group; see [../README.md](../README.md) for the overall ADR convention.

| ADR                                           | Title                                                | Status   |
| --------------------------------------------- | ---------------------------------------------------- | -------- |
| [0001](0001-injection-root-boundary.md)       | Injection-root boundary for local file reads         | Accepted |
| [0002](0002-injection-root-escape-hatch.md)   | Injection-root escape hatch (`--allow-outside-root`) | Accepted |
| [0003](0003-rollout-as-major-version-bump.md) | Ship as a breaking change in the next major version  | Accepted |

See also: [../../glossary.md](../../glossary.md).

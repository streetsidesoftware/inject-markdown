# Security hardening

ADRs for exposures found reviewing the injection-root boundary ([file-access-security/](../file-access-security/)) after it shipped — none of them a bypass of that boundary, all of them reachable under the same threat model: a directive is text in a Markdown file, so anyone who can open a pull request touching a processed document can supply one. The posture across this group is safe defaults where they cost users nothing, and documented guidance where a default would break legitimate use. Numbering restarts at `0001` within this group; see [../README.md](../README.md) for the overall ADR convention.

| ADR                                                  | Title                                                            | Status   |
| ---------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](0001-linear-time-directive-parsing.md)        | Linear-time directive parsing                                    | Proposed |
| [0002](0002-injection-root-bounds-file-discovery.md) | The injection root bounds file discovery, not only directive reads | Proposed |
| [0003](0003-remote-reference-guardrails.md)          | Guardrails for remote references                                 | Proposed |
| [0004](0004-deny-access-globs.md)                    | `--deny-access <glob>` for paths inside the injection root       | Proposed |
| [0005](0005-threat-model-and-safe-usage.md)          | Documented threat model and safe-usage guidance                  | Proposed |

See also: [../../glossary.md](../../glossary.md).

# Template variables

ADRs for template variable substitution: `{@ name @}` placeholders inside injected content, resolved against values supplied by the directive (inline options, a values file, CLI flags, or allow-listed environment variables) — not by the file being injected. Goal is simple value injection (e.g. `npm install myPackage@{@ version @}`), not a full template engine (no conditionals/loops). Numbering restarts at `0001` within this group; see [../README.md](../README.md) for the overall ADR convention.

| ADR                                                     | Title                                            | Status   |
| ------------------------------------------------------- | ------------------------------------------------ | -------- |
| [0001](0001-placeholder-syntax.md)                      | Placeholder syntax and encoding conventions      | Accepted |
| [0002](0002-directive-value-sources.md)                 | Directive-level value sources and opt-in trigger | Accepted |
| [0003](0003-cli-and-env-value-sources.md)               | CLI and environment value sources                | Accepted |
| [0004](0004-value-source-precedence.md)                 | Value source precedence and combination          | Accepted |
| [0005](0005-unresolved-placeholders-and-strict-mode.md) | Unresolved placeholders and strict mode          | Accepted |
| [0006](0006-substitution-mechanics-and-timing.md)       | Substitution mechanics and timing                | Accepted |
| [0007](0007-values-file-prefixing.md)                   | `values-file=` multi-file imports and prefixing  | Accepted |
| [0008](0008-value-layering-and-resolution.md)           | Value layering and per-leaf resolution           | Accepted |

See also: [../../glossary.md](../../glossary.md).

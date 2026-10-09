# Template variables

`{@ name @}` placeholders inside injected content, replaced with values that the directive supplies, not the file being injected. It needed design decisions because values can come from several places, and a directive has to mean the same thing wherever it's read.

## Why

- Injected snippets repeat values that change: versions, package names, URLs. Copies of those values go stale.
- With template variables, the document that injects a snippet supplies the values. One snippet stays correct everywhere it's used, and a release updates one place.
- Constraints: values come only from the directive and from the command line, never from the injected file. Environment variables are reachable only when allowed, so a directive can't read secrets from the environment.

## Stakeholders

- **Doc authors** reuse snippets across documents, and supply the values in the directive (`values=`, `value=`, `values-file=`, `value-alias=`).
- **Maintainers running releases or CI** supply run-wide values (`--value`, `--values-file`, `--value-alias`), and allow environment variables with `--allow-env`.
- **Readers of the generated docs** benefit indirectly: they see correct values.

## Goal

- **Doc authors:** one snippet is injected into several documents with different values, and each directive alone tells you which values it gets.
- **Maintainers:** a release changes a version in one place, and every injected copy updates on the next run.
- **Both:** a placeholder that doesn't resolve is visible, as a warning or, with `--strict-vars`, an error. It's never silently replaced.

## Out of scope

- A template engine: no conditionals, loops, or expressions.
- Values from the injected file.
- Turning objects or arrays into text. A placeholder that names one stays unresolved.
- Indexing into arrays in a placeholder name.
- Per-file values on the command line.
- Injecting several line ranges. That's a separate feature.

## Decisions

| ADR                                                     | Title                                                | Status                                                     |
| ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| [0001](0001-placeholder-syntax.md)                      | Placeholder syntax and encoding conventions          | Accepted                                                   |
| [0002](0002-directive-value-sources.md)                 | Directive-level value sources and opt-in trigger     | Accepted                                                   |
| [0003](0003-cli-and-env-value-sources.md)               | CLI and environment value sources                    | Accepted                                                   |
| [0004](0004-value-source-precedence.md)                 | Value source precedence and combination              | Superseded by [0012](0012-declaration-order-precedence.md) |
| [0005](0005-unresolved-placeholders-and-strict-mode.md) | Unresolved placeholders and strict mode              | Accepted                                                   |
| [0006](0006-substitution-mechanics-and-timing.md)       | Substitution mechanics and timing                    | Accepted                                                   |
| [0007](0007-values-file-prefixing.md)                   | `values-file=` multi-file imports and prefixing      | Accepted                                                   |
| [0008](0008-value-layering-and-resolution.md)           | Value layering and per-leaf resolution               | Accepted                                                   |
| [0009](0009-prefix-grammar-and-drive-letters.md)        | Values-file prefix grammar and Windows drive letters | Accepted                                                   |
| [0010](0010-value-alias.md)                             | `value-alias=` redefining a name to point at another | Accepted                                                   |
| [0011](0011-repeated-hash-keys.md)                      | Repeated directive hash keys                         | Accepted                                                   |
| [0012](0012-declaration-order-precedence.md)            | Declaration-order value precedence                   | Accepted                                                   |
| [0013](0013-singular-value-option.md)                   | Singular `value=` directive option                   | Accepted                                                   |

## Open questions

- **YAML values files.** Waiting on a need: the project has no YAML parser today.
- **An option that prints the resolved values.** Waiting on a request. Values are layered, not merged into one tree, so it would print the layers in order.
- **An error for a malformed `values=` entry**, as `value=` already gives. Waiting on a decision, since it changes an existing option.

See also: [glossary](../../glossary.md), [ADR glossary](../glossary.md).

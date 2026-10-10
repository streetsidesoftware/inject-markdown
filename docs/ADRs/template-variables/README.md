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

| ADR                                                     | Title                                                            | Status   |
| ------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [0001](0001-placeholder-syntax-and-escaping.md)         | Placeholder syntax and escaping                                  | Accepted |
| [0002](0002-opting-a-directive-in.md)                   | Opting a directive in                                            | Accepted |
| [0003](0003-inline-values-and-repeated-keys.md)         | Inline values: `values=` and `value=`, and repeated keys         | Accepted |
| [0004](0004-values-files.md)                            | Values files: format, paths, the injection root, and read errors | Accepted |
| [0005](0005-values-file-prefixes.md)                    | Values-file prefixes: derived, explicit, root, and drive letters | Accepted |
| [0006](0006-run-wide-values-on-the-command-line.md)     | Run-wide values on the command line                              | Accepted |
| [0007](0007-environment-variables.md)                   | Environment variables and `env.`                                 | Accepted |
| [0008](0008-declaration-order-precedence.md)            | Declaration-order precedence                                     | Accepted |
| [0009](0009-per-leaf-layered-resolution.md)             | Per-leaf layered resolution and `null`                           | Accepted |
| [0010](0010-aliases.md)                                 | Aliases                                                          | Accepted |
| [0011](0011-unresolved-placeholders-and-strict-vars.md) | Unresolved placeholders and `--strict-vars`                      | Accepted |
| [0012](0012-when-and-how-substitution-runs.md)          | When and how substitution runs                                   | Accepted |

## What we learned

- **Reading order beats source type.** Ranking values by where they came from looked principled, but once options could repeat, it contradicted the order a reader sees. The rule became "newest declaration wins", with the command line older than any directive.
- **A merge rule has to be one rule everywhere.** Three different merge behaviors grew up for cases that look identical in directive text. They were replaced by one: every declaration is a layer, and each name resolves per leaf.
- **Make the safe form the default.** Values files merged at the root by default, so adding a second file could shadow the first. Prefixing every file unless the author opts out removed that.
- **Ambiguous separators bite on Windows.** `:` separates a prefix from a path, and every absolute Windows path has one. A prefix needs two characters or more, so a drive letter is never one.
- **Silent loss is the worst failure.** A repeated key that discarded a file, a wholesale replace, a non-scalar that hid a real value: each produced wrong output with no message. Each fix either kept the data or reported the problem.

## Open questions

- **YAML values files.** Waiting on a need: the project has no YAML parser today.
- **An option that prints the resolved values.** Waiting on a request. Values are layered, not merged into one tree, so it would print the layers in order.
- **An error for a malformed `values=` entry**, as `value=` already gives. Waiting on a decision, since it changes an existing option.
- **A warning for a root-merged values file whose top level isn't an object.** Today it contributes nothing, silently. Should this warn?

See also: [glossary](../../glossary.md), [ADR glossary](../glossary.md).

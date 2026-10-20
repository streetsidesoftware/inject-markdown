# Feature designs

Each file or folder here is the design of one feature. A title that starts with `WIP:` means the design isn't settled yet. To write one, see [Designing a feature](../feature-design.md).

| Design                                        | Description                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Deny access](deny-access.md)                 | `--deny-access <glob>`: refuse directive reads of matching paths inside the injection root. |
| [Rebase output links](rebase-output-links.md) | `--rebase-output-links`: rebase relative links onto the `--output-dir` location.            |
| [Remote guardrails](remote-guardrails.md)     | WIP. Refuse private and loopback addresses for remote references, with time and size caps.  |
| [Table columns](table-columns.md)             | WIP. `columns`, `column-names`, `header-format`, and auto-alignment for tables.             |
| [Template variables](template-variables.md)   | `{@ name @}` placeholders in injected content, and where their values come from.            |

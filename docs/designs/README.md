# Feature designs

Each folder here holds the design of one feature. A title that starts with `WIP:` means the design isn't settled yet. To write one, see [Designing a feature](../feature-design.md).

## Built

The code and the user docs describe a built feature. Its design explains why it's shaped the way it is.

| Design                                             | Description                                                                      | User docs                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Template variables](template-variables/README.md) | `{@ name @}` placeholders in injected content, and where their values come from. | [Template variables guide](../guide/template-variables.md) |

## Planned

| Design                                               | Description                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Deny access](deny-access/README.md)                 | `--deny-access <glob>`: refuse directive reads of matching paths inside the injection root.  |
| [Markdown builders](markdown-builders/README.md)     | WIP. `inject-markdown/markdown`: build Markdown values that escape themselves when rendered. |
| [Rebase output links](rebase-output-links/README.md) | `--rebase-output-links`: rebase relative links onto the `--output-dir` location.             |
| [Remote guardrails](remote-guardrails/README.md)     | WIP. Refuse private and loopback addresses for remote references, with time and size caps.   |
| [Table columns](table-columns/README.md)             | WIP. `columns`, `column-names`, `header-format`, and auto-alignment for tables.              |

---
title: Frontmatter Example
description: 'An example with inject and Frontmatter'
permalink: /
---

## Import Markdown as Code

It is also possible to inject markdown:

<!--- @@inject-code: example.md --->

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

<!--- @@inject-end: example.md --->

<!--- @@inject-code: example2.md --->

```markdown
# Contains special characters

## How it works with camelCase

The concept is simple, split camelCase words before checking them against a list of known English words.

- camelCase -> camel case
- HTMLInput -> html input -- Notice that the `I` is associated with `Input` and not `HTML`
- snake_case_words -> snake case words
- camel2snake -> camel snake -- (the 2 is ignored)
```

<!--- @@inject-end: example2.md --->

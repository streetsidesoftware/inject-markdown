---
title: Example 2
description: 'An example with Frontmatter'
permalink: /
---

# Contains special characters

## How it works with camelCase

The concept is simple, split camelCase words before checking them against a list of known English words.

- camelCase -> camel case
- HTMLInput -> html input -- Notice that the `I` is associated with `Input` and not `HTML`
- snake_case_words -> snake case words
- camel2snake -> camel snake -- (the 2 is ignored)

# ADR-0001: Placeholder syntax and escaping

**Status:** Accepted

## Why

**Goal:** one snippet is injected into several documents with different values. That needs a marker in the snippet that says "a value goes here", and a way to show the marker itself.

**Problem:** without a fixed grammar, authors can't tell what counts as a placeholder, and this tool's own docs can't show the syntax without it being replaced.

## Decision

1. **Delimiter:** `{@ ... @}`. Whitespace just inside the delimiters is optional and ignored. `{@version@}`, `{@ version @}` and `{@  version  @}` are the same placeholder.
2. **Name grammar:** a dotted path of segments. Each segment matches `[A-Za-z0-9_][A-Za-z0-9_-]*`: a letter, digit or underscore, then any of those or a hyphen. So `package.version` and `build-info.sha` are names, and `{@ -foo @}` is not a placeholder at all. It stays as written.
3. **Dotted names address nested values.** A name with no dot is a top-level lookup. Each dot walks one level into a nested JSON object. A values file's `{"engines": {"node": "22"}}`, loaded under the prefix `package`, is read as `{@ package.engines.node @}`.
4. **Escaping:** a backslash right before a placeholder (`\{@ name @}`) keeps it as literal `{@ name @}` text. The backslash is removed. It escapes only that one placeholder. It is not a general escape character.
5. **All directive types use the same syntax:** `@@inject` (and `@@inject-start`), `@@inject-code` and `@@inject-table`. Only how the result is spliced into the document differs; see [When and how substitution runs](0012-when-and-how-substitution-runs.md).

## Consequences

- Hand-written Markdown can space placeholders either way.
- The README, guides and these ADRs can show `{@ ... @}` verbatim.
- A placeholder name and a values-file prefix share one segment rule, so authors learn one rule. A prefix only adds a two-character minimum; see [Values-file prefixes](0005-values-file-prefixes.md).
- Placeholder names can't index into arrays. That's out of scope.

## Context

- The feature request's example was `{@ variables.value @}`, which a dotted name covers.
- A segment can't start with a hyphen so that one rule serves both names and values-file prefixes. A prefix must refuse a leading hyphen because it sits next to a file path, and a name starting with a hyphen has no use.
- Escaping works on the text that substitution sees. In Markdown prose, the Markdown parser already reads `\{` as a character escape and drops the backslash, so `\{@ name @}` there is substituted. Write `\\{@ name @}` in prose. A single backslash works in code blocks, inline code, HTML and non-Markdown files.

## Rejected approaches

- Reusing the hash-option characters (`&`, `=`): [hash options](../../glossary.md#hashfragment-options) configure the directive, while placeholders live in content, a different surface.
- Requiring exactly one space inside the delimiters: hand-written Markdown varies, and hash option values are trimmed too.
- No escape: this tool's own docs need to show the syntax.
- A leading hyphen in a segment: no use for a name, and it would split the name and prefix rules.

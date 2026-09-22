# ADR-0001: Placeholder syntax and encoding conventions

**Status:** Proposed
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

Template variable substitution lets injected content contain placeholders like `{@ version @}` that get replaced with values supplied by the directive (not the file being injected) at injection time — e.g. an injected code sample containing `npm install myPackage@{@ version @}` becomes `npm install myPackage@1.2.3` in the output. This is deliberately not a full template engine: no conditionals, loops, or expressions, just name-to-value substitution.

Before deciding where values come from (subsequent ADRs), we need the placeholder grammar itself: the delimiter, how much whitespace is tolerated inside it, whether a name can address nested values, which directive types (`@@inject`/`@@inject-code`/`@@inject-table`, see [Directive.ts](../../../src/FileInjector/Directive.ts)) participate, and how to write a literal `{@ ... @}` in content that must not be substituted (this tool's own docs will want to show the syntax verbatim).

## Decision

1. **Delimiter:** `{@ ... @}`. Whitespace immediately inside the delimiters is optional and trimmed before lookup — `{@version@}`, `{@ version @}`, and `{@  version  @}` are equivalent.
2. **Name grammar:** a dotted path, each segment matching `[A-Za-z0-9_][A-Za-z0-9_-]*` — an alphanumeric or underscore, then any of those plus hyphens — e.g. `package.version`. A segment may not begin with a hyphen, so `{@ -foo @}` is not a placeholder and stays literal text. A name with no dot is a top-level lookup; a name with dots traverses into nested objects from whichever value source produced it (values-file JSON, see [ADR-0002](0002-directive-value-sources.md)). This matches the example in the originating feature request (`{@ variables.value @}`).
3. **Escaping:** a placeholder immediately preceded by a backslash (`\{@ ... @}`) is left as literal `{@ ... @}` text in the output, with the backslash stripped. This only suppresses substitution for that one occurrence — it is not a general-purpose Markdown escape character.
4. **Directive scope:** `@@inject`/`@@inject-start`, `@@inject-code`, and `@@inject-table` are all eligible for substitution, subject to the opt-in trigger decided in [ADR-0002](0002-directive-value-sources.md). The placeholder syntax and name-resolution rules are identical across all three; only how the resulting text gets spliced into the document differs (see [ADR-0006](0006-substitution-mechanics-and-timing.md)).

## Options Considered

- **Allowing a leading hyphen in a segment** (`[A-Za-z0-9_-]+`) — the original form of point 2, tightened so that one rule covers both a placeholder name and a [values-file prefix](0009-prefix-grammar-and-drive-letters.md). A prefix must refuse a leading hyphen because it sits next to a file path; having the name grammar agree costs nothing, since a name beginning with a hyphen has no use, and it removes an asymmetry authors would otherwise have to remember.

- **Reusing the existing `#`-hash option character set (`&`, `=`) for placeholders** — rejected: hash options ([hash.ts](../../../src/util/hash.ts)) configure the directive itself, while placeholders live in the injected _content_, a different surface entirely; reusing that syntax there would collide with legitimate content and blur the two concepts.
- **Requiring exact single-space spacing (`{@ name @}`)** — rejected in favor of trimmed/optional whitespace: hand-authored Markdown varies, and trimming keeps the mental model consistent with how `parseHashString` already trims option values.
- **No escape mechanism** — rejected: this repo's own docs (README, ADRs, this file) need to show the `{@ ... @}` syntax verbatim without it being interpreted as a live placeholder.

## Consequences

- The placeholder scanner needs to (a) find and neutralize backslash-escaped occurrences first, then (b) match `\{@\s*([A-Za-z0-9_][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_][A-Za-z0-9_-]*)*)\s*@\}` for everything else.
- Dotted-path resolution needs a small "walk into an object by key segment" helper, shared across whichever value source produced the lookup tree ([ADR-0002](0002-directive-value-sources.md), [ADR-0003](0003-cli-and-env-value-sources.md)).
- New glossary terms: **Placeholder**, **Placeholder name**.

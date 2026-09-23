# ADR-0013: Singular `value=` directive option

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

A directive's inline values come from `values=name:val,name2:val2` ([ADR-0002](0002-directive-value-sources.md) point 1). A value containing a comma needs whole-value quoting (`values="range:1, 2, 3"`), and [ADR-0011](0011-repeated-hash-keys.md) point 4 offers repeating the key as the other way to write one. Both are workarounds for a parser built for lists.

With [ADR-0012](0012-declaration-order-precedence.md), declarations are an ordered sequence in which position decides precedence, so writing one value per occurrence is the natural unit. The CLI already has a singular `--value name=val` ([ADR-0003](0003-cli-and-env-value-sources.md)); the directive has no counterpart.

## Decision

1. **`value=name:val` sets exactly one name.** It splits at the first `:` only; everything after it is the value, commas and further colons included, with no quoting. `#value=range:1, 2, 3&value=url:https://x.dev` sets `range` to `1, 2, 3` and `url` to `https://x.dev`. Name and value are trimmed, as in `values=`.
2. **It is repeatable, and each occurrence is one declaration** in the [ADR-0012](0012-declaration-order-precedence.md) sequence, interleaving with `values=`, `values-file=` and `value-alias=` by position.
3. **A malformed occurrence is a directive error.** No `:` (`value=version`) or an empty name (`value=:1.0`) is reported the way an unreadable `values-file=` entry is. `value=name:` is valid and sets the empty string.
4. **`value=` opts a directive in** to placeholder scanning, alongside `values=`, `values-file=`, `value-alias=` and bare `vars` ([ADR-0002](0002-directive-value-sources.md) point 4).
5. **`values=` is unchanged**, including silently dropping a malformed entry and its quoting rule. The two are equals; `values=` stays the compact form for several short values.

## Options Considered

- **`value=` as a plain alias of `values=`** (same comma-splitting and quoting) — rejected: it adds a name without removing the quoting workaround that motivates it.
- **`value=name=val`**, matching the CLI's `--value` — rejected: `value=a=b` is hard to read next to the hash's own `key=value` separator, and `name:val` is what `values=` and `value-alias=` already use inside a directive.
- **Silently dropping a malformed `value=`**, matching `values=` — rejected: with one pair per occurrence, a missing colon is always a typo, and dropping it would only surface later as an unresolved-placeholder warning that points at the wrong place.
- **Making malformed `values=` entries an error too** — rejected for now: it changes the behavior of an existing option, which is outside this ADR's scope.

## Consequences

- `parseHashString` gains a `value` case feeding the same ordered declaration list as the other value options, and a parse error path for point 3.
- "Rest literal" applies after hash decoding: the options are parsed with `URLSearchParams`, so `&` must be written `%26` and a `+` decodes to a space (`%2B` for a literal plus), exactly as for `values=` today.
- New glossary term: **`value=` option**.

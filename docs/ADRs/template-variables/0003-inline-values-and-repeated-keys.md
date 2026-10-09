# ADR-0003: Inline values: `values=` and `value=`, and repeated keys

**Status:** Accepted

## Why

**Goal:** each directive alone tells you which values it gets. For a handful of literal values, the simplest way is to write them in the directive.

**Problem:** without inline values, every value needs a file. And if a repeated key kept only its last occurrence, a directive could silently lose values that its text plainly declares.

## Decision

1. **`values=name:val,name2:val2` sets several values.** Pairs are separated by commas. Each pair splits at its first `:`. Name and value are trimmed. `value` may be empty (`values=note:`).
2. **A quoted `values=` holds exactly one pair.** If the whole value is wrapped in double quotes, it is not split on commas: `values="range:1, 2, 3"` sets `range` to `1, 2, 3`. Quoting a single pair inside a longer list doesn't work.
3. **A malformed `values=` pair is dropped silently.** A pair with no `:` or an empty name sets nothing.
4. **`value=name:val` sets exactly one value.** It splits at the first `:`. Everything after it is the value, commas and further colons included, with no quoting: `#value=range:1, 2, 3&value=url:https://example.com`. Name and value are trimmed. `value=name:` sets the empty string.
5. **A malformed `value=` is a directive error.** No `:` (`value=version`) or an empty name (`value=:1.0`) is reported at the directive. A bare `#value` or `#value=` is not this option; it stays a heading reference.
6. **The four list options accumulate in document order.** `values=`, `value=`, `values-file=` and `value-alias=` gather every occurrence, as if written as one list. `#values-file=a.json&values-file=b.json` is the same as `#values-file=a.json,b.json`. Each pair or entry is its own declaration, in the order it's written, interleaved across the four options; see [Declaration-order precedence](0008-declaration-order-precedence.md).
7. **Every other option keeps its last occurrence, silently.** `heading=`, `code=`/`lang=`, `quote`, `vars`, `lines=`/`line=` and a bare `L1-L10` range each hold one value. A repeat replaces it, with no warning.
8. **Hash decoding comes first.** Options are parsed with `URLSearchParams`, so `&` must be written `%26`, and `+` decodes to a space (`%2B` for a literal plus).

## Consequences

- A few short values fit in one `values=`. A value with commas or colons fits in `value=`, without quoting.
- Repeating a key is safe: it never discards an earlier file or value.
- A typo in a `values=` pair is only noticed when a placeholder that needed it is reported unresolved. A typo in `value=` is reported where it is written.
- Injecting several line ranges isn't possible. A repeated range replaces the earlier one.

## Context

- The feature request proposed `#value:name=project` per name. `values=` follows the comma-list convention of `columns` instead, and whole-value quoting for literal commas; see the option-encoding conventions in [table-improvements](../table-improvements/README.md).
- A repeated key used to keep only its last occurrence. `#values-file=:./package.json&values-file=release:releases.json` silently dropped `package.json`, and every name it supplied went unresolved. The comma form worked, so the two spellings disagreed with no sign of which one the author got.
- `value=` came from the same problem from the other side: `values=` needs quoting for a value with a comma, and once declarations are ordered, one value per occurrence is the natural unit. The CLI already had `--value`.
- `value=` errors on a malformed pair where `values=` drops it. With one pair per occurrence, a missing colon is always a typo. Dropping it would only surface later, as an unresolved placeholder pointing at the wrong place. Changing `values=` to match is an open question.
- One exception in option parsing predates this feature: a bare key read as a heading (`#Install`) takes the first one. A later `heading=` still replaces it.

## Rejected approaches

- Repeated `value:name=val` keys, as the feature request proposed: a new key shape, unlike every other option.
- `value=` as a plain alias of `values=`: it keeps the quoting workaround that motivated it.
- `value=name=val`, matching the CLI's `--value`: `value=a=b` is hard to read next to the hash's own `=`, and the directive's other options use `name:val`.
- Accumulating line ranges too: multi-range injection is a separate feature.
- Warning on, or rejecting, a repeated single-value key: it would fire on directives that work and read correctly.
- Deprecating the comma list in favor of repeated keys: the comma list is the compact form, and the fixtures use it.

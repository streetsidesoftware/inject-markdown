# ADR-0010: Aliases

**Status:** Accepted

## Why

**Goal:** one snippet is injected into several documents with different values. A snippet uses short names like `{@ version @}`, while the values come from files under their own namespaces.

**Problem:** prefixes make every values file addressable but make names long, such as `{@ release.latest.version @}`. Copying the value into `values=` goes stale. Root-merging the file drops the namespace for all of its keys and collides with whatever else is at the root.

## Decision

1. **Grammar.** In a directive, `value-alias=new:target[,new2:target2...]`, the same comma-separated `name:value` shape as `values=`: pairs split at the first `:`, both sides are trimmed, a whole value in double quotes is one pair, and a malformed pair is dropped. On the command line, a repeatable `--value-alias <new>=<target>`, split at the first `=`; an empty name, or no `=` at all, stops the run with an error. In the library API, `{ kind: 'alias', name, target }` in `valueDeclarations`.
2. **Both sides are placeholder names.** The new name and the target both follow the dotted name grammar ([Placeholder syntax and escaping](0001-placeholder-syntax-and-escaping.md)). `--value-alias build.version=release.latest.version` makes `{@ build.version @}` resolve through it.
3. **An alias is a declaration, ordered like any other.** For a given name, the newer of an alias for it and a value for it decides the name. In `#values=version:1.0&value-alias=version:release.version`, the alias applies. Reversed, `1.0` does. See [Declaration-order precedence](0008-declaration-order-precedence.md).
4. **An alias holds no value.** Resolving the new name resolves the target at that moment, against the whole sequence. A values file declared after the alias can satisfy it.
5. **Chains are followed, and cycles are reported.** If a target is itself aliased, resolution follows it. A name that repeats on the path is a cycle: the placeholder is unresolved, and the message names the cycle.
6. **A target may be any name, including `env.NAME`.** It resolves through the reserved namespace and so stays subject to `--allow-env`.
7. **An alias whose target doesn't resolve leaves the placeholder unresolved.** Resolution doesn't fall back to older declarations for the aliased name. The message names both sides.
8. **`value-alias=` opts a directive in**, like the other value options; see [Opting a directive in](0002-opting-a-directive-in.md).

## Consequences

- One alias can redefine a name a root-merged file already supplies, without copying the value.
- Since an alias decides its name when it is newest, a broken target is reported rather than masked by an older value.
- An alias is singular (`value-alias`) because each entry maps one name to one name.
- `--strict-vars` applies unchanged. An unresolved alias, including a cycle, becomes a directive error.

## Context

- The motivating directive loads two files and wants one name from the second to override the first: `#values-file=:./package.json&values-file=release:releases.json&value-alias=version:release.latest.version`. `package.json` is root-merged, so it already defines `version`, and the alias has to redefine it.
- An alias is one more entry in the declaration sequence, not a rank above the values of its scope, so the directive's order is the whole rule.
- A values-file prefix is at least two characters. Aliases cover the case where a shorter name is wanted.
- Rule 2 is not enforced yet: #884.

## Rejected approaches

- An alias only fills a gap when nothing else defines the name: the motivating case is a name already defined.
- An alias ahead of every other declaration: a command-line alias would override a directive's own values.
- One hop, no chaining: an alias over an aliased name would fail in a way that's hard to see.
- A single-segment new name only: an exception to the name grammar, for no gain.
- Excluding `env.` targets: the allow-list already decides what is reachable.
- Plural `values-alias=`: each entry maps exactly one name.
- Copying the value into `values=`: it duplicates a value the directive already loads, and goes stale.

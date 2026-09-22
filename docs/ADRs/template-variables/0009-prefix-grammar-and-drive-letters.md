# ADR-0009: Values-file prefix grammar and Windows drive letters

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

[ADR-0007](0007-values-file-prefixing.md) point 1 defines a `values-file=`/`--values-file` entry as `[prefix:]path`. `parseValuesFileEntry` implements that by splitting at the first colon, which collides with a Windows drive letter: every absolute Windows path starts with one.

The collision is not a read failure — it is silent and wrong:

| entry                 | parsed as                            | effect                                          |
| --------------------- | ------------------------------------ | ----------------------------------------------- |
| `c:package.json`      | prefix `c`, path `package.json`      | reads a real `package.json` under namespace `c` |
| `C:\data\values.json` | prefix `C`, path `\data\values.json` | reads the wrong absolute path                   |
| `C:/data/values.json` | prefix `C`, path `/data/values.json` | reads the wrong absolute path                   |

`c` and `C` are valid placeholder-name segments, so nothing rejects them. The first row is the worst case: it reads a file that exists and namespaces it under a prefix the author never wrote, with no error at all. Windows is in the test matrix, and `--values-file` is the option most likely to be given an absolute path.

ADR-0007 point 1 offers whole-entry quoting as the escape hatch, but reaching it from PowerShell means embedding quotes inside quotes (`'"C:\data\values.json"'`), which is not a usable answer for the common case.

## Decision

1. **A prefix identifier matches `[A-Za-z0-9._-]{2,}`.** The colon is a separator only when the text before it matches; otherwise the whole entry is a path. A Windows drive letter is always exactly one character, so it can never be read as a prefix — `C:\data\v.json`, `C:/data/v.json` and `C:package.json` are all paths. The class excludes `/` and `\`, so `\\?\C:\data\v.json` and other path-shaped heads are paths for the same reason.
2. **A single-character head is a path, not an error.** `v:data.json` is the file `v:data.json`. The rule is applied as stated rather than special-cased into a diagnostic: the parser never guesses which of the two a one-letter head was meant to be. Single-character prefixes are simply not available; use two characters or more.
3. **A dotted explicit prefix nests**, via the same `setPath` walk a dotted placeholder name uses. `values-file=pkg.build:data.json` places the file under `{@ pkg.build.* @}`. This is what the `.` in point 1's class is for.
4. **Auto-derived prefixes stay single-segment.** A prefix inferred from a basename must match `[A-Za-z0-9_-]+` — no dots. [ADR-0007](0007-values-file-prefixing.md) point 5 stands unchanged: `v1.2.json` and `data.local.json` remain directive errors asking for an explicit prefix or `:path`. Point 3's nesting is for a namespace an author typed deliberately; a filename that happens to contain a dot is not that, and silently turning `v1.2.json` into a `v1` namespace is exactly the surprise point 5 exists to prevent.
5. **Auto-derivation strips a drive prefix first.** `deriveAutoPrefixFromPath` drops a leading `<letter>:` before taking the basename, so `c:package.json` derives `package` and `C:\data\values.json` derives `values`. Without this, point 1 would turn a drive-relative path into an auto entry whose basename still contains the drive, deriving `c:package` and failing as an invalid prefix — trading a silent wrong read for a confusing rejection of a path that is perfectly valid on Windows.
6. **`:` stays the separator.** The `[prefix:]path` grammar is unchanged apart from what counts as a prefix.

## Options Considered

- **Switching the separator to `=`** (`--values-file pkg=data.json`, `:` freed for drives) — rejected. It is not collision-free either, since `=` is legal in filenames on both platforms, so `a=b.json` has the same class of ambiguity, just rarer. It needs an `==` form for the root merge, which reads badly in a directive (`values-file==data.json`). And it would rewrite ADR-0007, the README, `content/help.txt` and every fixture for a collision that only ever bites on the CLI.
- **A drive-letter heuristic** — treat a one-character head as a drive only when the next character is `/` or `\` — rejected in favor of the flat 2-character rule. It would keep single-character prefixes working in the `v:data.json` form while rejecting them in `v:/data.json`, which is a rule that has to be explained rather than stated.
- **Erroring on a single-character head** with a message naming the 2-character rule — rejected: it makes the parser infer intent from a shape that is a legal relative filename, and the rule is easier to hold as "prefixes are two or more characters" with no exception attached.
- **Documentation only**, relying on ADR-0007 point 1's whole-entry quoting — rejected: quoting survives, but requiring `'"C:\data\values.json"'` from PowerShell for the ordinary case is not a fix, and it leaves `c:package.json` silently reading the wrong file.
- **Allowing dots in auto-derived prefixes too** — rejected as point 4 records; it would reverse ADR-0007 point 5 and make a version-named file into a namespace tree.

## Consequences

- `parseValuesFileEntry` gains a prefix test before it treats the colon as a separator, and `isValidPlaceholderSegment` is no longer the right check for a prefix: an explicit prefix is a dotted path of segments, an auto-derived one is a single segment. Those are two different predicates.
- Single-character prefixes stop being expressible. Nothing in the repo used one, and [ADR-0010](0010-value-alias.md)'s `value-alias=` covers the case a short name was wanted for.
- PowerShell's multi-character provider drives (`Temp:`, `HKLM:`, a custom PSDrive) satisfy the prefix rule and would parse as prefixes. PowerShell does not expand provider paths for native commands, so Node could not resolve them regardless; this is a documentation note, not a behavior to defend against.
- A path that genuinely needs a two-or-more-character head read as a path — a POSIX file literally named `ab:c.json` — still has ADR-0007 point 1's whole-entry quoting.
- New glossary terms: **Explicit prefix**, updated **Auto-derived prefix**.

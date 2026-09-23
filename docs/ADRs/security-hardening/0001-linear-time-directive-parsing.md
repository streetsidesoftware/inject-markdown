# ADR-0001: Linear-time directive parsing

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

`parseDirective` in [Directive.ts](../../../src/FileInjector/Directive.ts) matches a candidate HTML comment against a single expression:

```js
/^[ \t]*<!--+\s*@@inject(?<type>|-start|-end|-code|-table)[:\s]\s*(?<file>.*?)-+->$/;
```

The tail `(?<file>.*?)-+->$` pairs a lazy group with a greedy run of the same character the group can also consume. On a line containing a long run of dashes, the engine retries `-+` from every position the lazy group hands it, and the cost is quadratic in the length of that run. Measured end-to-end through the CLI, on a file whose only content is one `@@inject` comment padded with dashes:

| dashes on the line | wall time |
| ------------------ | --------- |
| 5 000              | 0.4s      |
| 20 000             | 1.1s      |
| 60 000             | 6.7s      |

Extrapolating the fitted quadratic, a ~600 KB line costs on the order of ten minutes of pegged CPU. The path is fully reachable: `remark` parses the line into an `html` node, the `directiveRegExp` pre-filter matches on the literal `<!--- @@inject` prefix, and `parseDirective` then runs the expensive match. One Markdown file in a pull request is enough, which places it squarely in the threat model [file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) is written against: a directive is just text, and anyone who can open a pull request touching a processed `.md` file can supply it.

## Decision

Parse the directive in two steps, neither of which can backtrack super-linearly.

1. Match the **prefix** with an anchored expression whose every quantifier is followed by a literal or a bounded class, so it cannot blow up: `^[ \t]*<!--+\s*@@inject(?<type>|-start|-end|-code|-table)[:\s]\s*`.
2. Require the remainder to end with the comment **terminator**, using string operations rather than a pattern: strip one trailing `>`, then strip the run of `-` preceding it, and require at least two dashes to have been consumed (`-+->` accepts nothing shorter than `-->`).

Whatever is left, trimmed, is the file reference — exactly as `.trim()` produces it today.

This accepts the same language as the current expression. Because the pattern is `$`-anchored, the lazy group's only function is to hand the maximal trailing dash run to `-+`; the set of accepted lines is "prefix, then arbitrary text, then two or more dashes, then `>`, at end of line", and the capture is always the text before that trailing run. The two-step form computes the same split directly, in one pass.

The `directiveRegExp` pre-filter is already linear (`/^[ \t]*<!---?\s*@@inject(\b|-)/` has no unbounded backtracking) and is unchanged.

## Options Considered

- **Cap the length of a comment node** and treat anything longer as not-a-directive — rejected: it invents a limit the format doesn't have, and silently ignores an over-long directive rather than reporting it, turning a denial-of-service fix into a correctness surprise. It also leaves the quadratic behavior in place for inputs just under the cap.
- **Narrow the group to `[^>]*`** so it cannot overlap the terminator — rejected: cheapest edit, but it bans `>` anywhere in a reference or its hash options. `columns=` values are arbitrary header text ([table-improvements/ADR-0003](../table-improvements/0003-table-columns-option.md)), so this would silently stop matching directives that are legal today.
- **Leave it and document it** — rejected under this group's posture: the fix is confined to one function, changes no behavior, and the alternative is a denial of service reachable from a single file.

## Consequences

- Parsing a directive becomes linear in line length; the pathological input above drops from seconds to milliseconds.
- No user-visible change. The same lines parse to the same `Directive`, so no fixture, snapshot, or documented behavior moves.
- Regression coverage is a pathological input (a ~1 MB dash run) asserted under a generous `vitest` timeout of a couple of seconds. Pre-fix that input takes minutes and post-fix milliseconds, so the ~1000x margin fails loudly on a real regression without tripping on a slow CI runner — a correctness assertion alone would not stop someone reintroducing a backtracking pattern.
- `parseDirective` grows a few lines of explicit string handling in place of one dense expression. The regex's behavior was not obvious to begin with; the replacement states the terminator rule outright.

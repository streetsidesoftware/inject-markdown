# ADR-0002: Opting a directive in

**Status:** Accepted

## Why

**Goal:** a placeholder that doesn't resolve is visible, as a warning or an error. That only helps if the warnings are about placeholders the author meant.

**Problem:** scanning every directive would warn about any `{@ ... @}` text in content that never meant to use this feature, including this tool's own docs that show the syntax.

## Decision

1. **A directive is scanned for placeholders only if it carries a trigger.** The triggers are:
   - `values=`
   - `value=`
   - `values-file=`
   - `value-alias=`
   - the [bare flag](../../glossary.md#bareflag-option) `#vars`
2. **An option that parses to nothing still opts in.** `#values=` with no pairs, or a malformed `value=` that is reported as a directive error, still makes the directive scanned.
3. **`#vars` is for directives with no values of their own.** It opts in so the directive can use run-wide values and allowed environment variables alone. `#vars=false` (or `no`, `n`, `f`) does not opt in.
4. **A bare `#value` (or `#value=`) is not a trigger.** It keeps its meaning as a heading reference, so a directive that injects a section titled "value" is unaffected.
5. **A directive without a trigger leaves its content alone.** `{@ ... @}` text passes through unchanged and silently, backslash escapes included.

## Consequences

- Existing directives behave as before, whatever their content holds.
- Run-wide values from the command line reach only directives that opt in. A directive with no values of its own needs `#vars`.
- A typo in a trigger name (`#value-file=`) means no scanning and no warning. The unresolved-placeholder warning can't catch it.

## Context

- `#vars` follows the bare-flag form that `header-rows` introduced; see the option-encoding conventions in [table-improvements](../table-improvements/README.md).
- Every option that declares values is a trigger, so a directive never declares values that are then ignored.
- `URLSearchParams` can't tell `#value` from `#value=`, which is why both keep the heading meaning.

## Rejected approaches

- Always scanning: false warnings on content that only shows the syntax.
- Only `#vars` as a trigger: every directive with `values=` would also need `#vars`, though `values=` already says the author wants substitution.

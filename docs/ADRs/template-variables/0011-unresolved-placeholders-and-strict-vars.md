# ADR-0011: Unresolved placeholders and `--strict-vars`

**Status:** Accepted

## Why

**Goal:** a placeholder that doesn't resolve is visible, as a warning or, with `--strict-vars`, an error. It's never silently replaced.

**Problem:** a typo in a name, a missing values file, or a name that stops one segment short would otherwise produce wrong output with no sign of it.

## Decision

1. **A placeholder is unresolved when no layer holds its name as a scalar.** That covers a name nothing defines, a name every layer holds as an object, array or `null`, an alias whose target doesn't resolve, an alias cycle, and an `env.` name that isn't allowed or set.
2. **An unresolved placeholder stays in the output exactly as written.**
3. **One message per unique name per directive**, at the directive's position, however often the name occurs.
4. **By default the message is a warning.**
5. **`--strict-vars` makes it a directive error.** It then follows `--stop-on-errors` and `--write-on-error` like any other directive error. It doesn't abort the run by itself.
6. **The message says why.** It reads `Unresolved placeholder "{@ name @}": <reason>`, where the reason is one of:
   - `no value source defines it`: typically a typo or a missing source;
   - `resolves to an object, not a value` (or `an array`, or `null`): typically a name that stops one segment short, such as `{@ package.engines @}` for `{@ package.engines.node @}`;
   - `aliased to "<target>": ` followed by one of the above, for an alias whose target doesn't resolve;
   - `alias cycle through "<target>"`.
7. **Objects and arrays are never turned into text**, in either mode.

## Consequences

- Wrong output is visible on every run, and CI can make it fail with `--strict-vars`.
- A repeated placeholder doesn't flood the output.
- The author can tell "I misspelled this" from "I pointed at a branch" from "the alias points nowhere".
- Turning objects into text stays out of scope; this is value injection, not templating.

## Context

- The feature request specified this default: unresolved placeholders stay untouched with only a warning, and a strict mode is available when that's not acceptable.
- The alias reason came with aliases: an alias points somewhere, and that somewhere can be empty, so the message has to name both sides.
- For an `env.` name, the message doesn't yet hint at `--allow-env`: #886.

## Rejected approaches

- Turning objects or arrays into JSON text: the start of a template engine, which is out of scope.
- `null` as an empty string: the likely cause, a name the data doesn't really carry, would become silently empty output.
- One generic message: the fixes differ, and telling them apart costs one branch.
- An error for a non-scalar outside strict mode: contradicts the default of a warning.
- One message per occurrence: a value used on several lines would flood the output without adding information.
- `--strict-vars` aborting the whole run: every other injection error is collected per document.

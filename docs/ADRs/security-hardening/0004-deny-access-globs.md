# ADR-0004: `--deny-access <glob>` for paths inside the injection root

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

[file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) stops a directive reading outside the injection root. It says nothing about what sits _inside_ it, and continuous integration routinely puts secrets there: an `.npmrc` carrying a publish token, a `.env` written by a setup step, a service-account JSON or `kubeconfig` dropped into the workspace, a `.git/config` rewritten with an authenticated remote. Under the same threat model — a directive is attacker-supplied text — every one of those is still readable and still lands in the generated document.

Running with `--cwd docs/` rather than the repository root narrows the exposure and is worth recommending, but it only helps when the documentation happens to live in its own subtree, and it says nothing about a secret that lands _within_ that subtree.

ADR-0001 considered and rejected a denylist of sensitive filename patterns. That rejection was specific: a list _the tool maintains_ is never complete, and it cannot substitute for a boundary because an escape like `../../../etc/passwd` reaches things no pattern happens to name. Neither objection applies to a list the **operator** supplies on top of an intact boundary. The operator knows which paths in their own tree are sensitive; the tool does not, and should not guess.

## Decision

Add a repeatable `--deny-access <glob>` CLI option, with a matching `FileInjectorOptions.denyAccess?: string[]` per this repo's convention of mirroring every CLI option into the options interfaces. A local directive reference whose target matches any pattern is refused.

### Scope

The option governs **directive reads only** — it is evaluated where the injection root is enforced, in `resolveWithinInjectionRoot`. It does not change which files are discovered and processed: a denied `.md` file can still be a document in its own right, it just cannot be pulled into another one. Keeping discovery ([ADR-0002](0002-injection-root-bounds-file-discovery.md)) separate keeps one flag from meaning two things.

Remote references are unaffected; a glob describes paths, and remote destination policy is [ADR-0003](0003-remote-reference-guardrails.md)'s business.

### Precedence

**A deny match always wins.** It refuses regardless of `--allow-outside-root`, and regardless of where the target sits. Whether a given path is reachable is then answerable by reading the deny patterns alone, without tracing argument order — which is the property that matters when auditing a pipeline. This deliberately rules out `.gitignore`-style last-match-wins re-opening of a subpath.

### What the pattern matches

- A pattern **not** beginning with `**/` is matched against the target's path **relative to the injection root**. `.env*` denies a `.env` at the root of the tree; `internal/**` denies that subtree. This is the common case and reads naturally against the tree being processed.
- A pattern **beginning with `**/`** is matched against the target's **absolute path**, making it filesystem-wide. `**/*.env` denies every `.env` the tool could otherwise reach, including inside a directory permitted by `--allow-outside-root`. This is the form to reach for when the point is "never, anywhere", rather than "not in this tree".

Two further rules, both load-bearing:

- **Patterns match dotfiles.** Denying `.env` is the motivating case, and standard glob semantics exclude a leading dot from `*` unless asked otherwise.
- **The target is matched in both resolved forms** — the textually resolved path and the `realpath` — and a match on either denies. Matching the written reference alone would let a symbolic link inside the root (`docs/notes.md` → `../.env`) slip past a `.env*` pattern; matching the `realpath` alone would make the verdict depend on the file existing. Testing both mirrors the two-gate structure ADR-0001 already establishes and keeps the common case existence-independent.

### Default and reporting

Empty. No patterns unless the operator supplies them — the tool stays out of the business of deciding what is sensitive.

A denial is reported exactly as the injection-root denial is: fatal, and worded `Access denied`, naming the pattern that matched so the operator can act on it. A deny match is a pure glob evaluation over a path, so — unlike ADR-0003's destination policy — saying why reveals nothing that the person who authored the pattern does not already know.

## Options Considered

- **A denylist the tool ships and maintains** (`.env*`, `id_rsa*`, `*.pem`, …), whether as the default for this option or hard-coded — rejected: this is the never-complete list ADR-0001 argued against, and it would silently break anyone legitimately injecting from a dotfile. An operator-supplied list has neither problem.
- **Covering file discovery as well as reads** — rejected: `--deny-access 'internal/**'` stopping those files being _rewritten_ is defensible, but it overloads one name with two grants. ADR-0002 already bounds discovery, and an operator who wants files excluded from the working set can narrow the glob they pass.
- **`.gitignore`-style ordered allow/deny evaluation** — rejected: familiar, and it permits re-opening a subpath of a broad deny, at the cost of making reachability depend on argument order. For a security control, order-independence is worth more than expressiveness.
- **Guidance only — recommend `--cwd docs/` and document the residue** — rejected as insufficient on its own: it depends on a repository layout not every project has, and offers nothing for a secret inside the documentation subtree. The guidance is still worth giving, and [ADR-0005](0005-threat-model-and-safe-usage.md) gives it; this option is what makes it actionable.

## Consequences

- An operator can close the in-root residue for the paths they know about, without the tool guessing. `--deny-access '**/*.env' --deny-access '.npmrc'` is a realistic continuous-integration baseline.
- It is opt-in, so it protects nobody who does not configure it. That is the deliberate trade against a maintained default list, and [ADR-0005](0005-threat-model-and-safe-usage.md) has to say so plainly rather than implying the tool is safe out of the box.
- The two matching bases (`**/`-prefixed patterns being absolute, everything else root-relative) is a rule that has to be documented carefully. It is a small surprise, and it is what makes a pattern able to reach into an `--allow-outside-root` directory at all.
- Glob matching needs an explicit dependency. `globby` is already a direct dependency and brings `picomatch` in transitively via `fast-glob`, but relying on a transitive package is not something to do deliberately — either `picomatch` becomes a direct dependency or the matching goes through a `globby` entry point that exposes it.
- Patterns are matched per directive reference, against a path already computed by the boundary check. No extra filesystem access.
- Path separators must be normalized before matching, so a pattern written with `/` behaves the same on Windows.

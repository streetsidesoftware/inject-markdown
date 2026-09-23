---
name: refactor
description: 'Restructure existing inject-markdown code without changing its observable behavior: extracting or splitting modules, moving code between files, renaming across the codebase, or changing internal abstractions (e.g. how FileInjector, Directive, or FileSystemAdapter are organized internally). Establishes a green baseline before touching anything, plans the target structure, executes in small verified steps, and proves behavior is unchanged at the end. Use when the user asks to restructure, reorganize, split up, extract, move, or rename something across multiple call sites — or when a change is large/risky enough that "just edit it" could silently change behavior. Do not use for: pure bug fixes (behavior is supposed to change), small single-spot cleanups with no behavior risk (see the simplify skill), or designing new behavior that does not exist yet (see the feature-adr skill).'
---

# Refactor

Restructure code while keeping its behavior identical. The risk in a refactor isn't writing the new structure — it's not noticing that the new structure behaves differently from the old one. Every step in this workflow exists to make that noticing automatic instead of hopeful.

## When to use vs. the neighboring skills

- **This skill**: the change spans multiple files or call sites, changes an internal abstraction, or is large enough that a single "just edit it" pass risks an unnoticed behavior change.
- **`simplify`**: a small, local cleanup (dedupe, tighten, drop dead code) with no realistic behavior risk — no need for the baseline/checkpoint ceremony below.
- **`code-review`**: reviewing someone else's diff, not producing one.
- **`feature-adr`**: the target behavior doesn't exist yet and needs deciding. If a "refactor" request turns out to also want new behavior, stop and point the user at `feature-adr` for that part first — don't let new behavior sneak in under a refactor label.

## Workflow

### 1. Establish a green baseline before changing anything

Run `pnpm lint`, `pnpm build`, and `pnpm test`. If anything is already red, stop and tell the user — a refactor can't prove "no behavior change" against a baseline that doesn't pass, and fixing the baseline is a different task (bug fix or otherwise) from the refactor itself.

Also run `git status`: uncommitted changes sitting in the tree make it impossible to tell your diff apart from pre-existing work later. Ask the user to commit or stash first if the tree isn't clean.

### 2. Decide whether this needs a worktree

For a refactor that will span many files or several commits, use `EnterWorktree` (named after the refactor, e.g. `split-file-injector`) so it doesn't tie up the user's current branch mid-flight — same reasoning as `feature-adr` step 1. Skip it for a refactor that's realistically one or two commits, or if the session is already in a worktree.

### 3. Read the real code and state the target structure before moving anything

Read every file the refactor touches — don't restructure from a guess at what a file contains. Then write a short before/after plan: which files/functions move where, what gets renamed to what, what the new boundary is. Keep it concrete (real file and function names), not abstract ("clean up the module").

If there's more than one reasonable target structure (e.g. which module owns a helper, whether to split by responsibility or by call site), use `AskUserQuestion` to settle it before executing — cite the tradeoff in one line each way. Don't silently pick one and let the user discover it in the diff.

Cross-check the plan against `CONTRIBUTING.md`'s Architecture section and the module boundaries it describes (`FileSystemAdapter` wraps all `fs` access, `VFileEx` carries injection metadata, etc.) — a refactor that quietly blurs one of these boundaries is a design change wearing a refactor's clothes; flag it to the user instead of doing it.

### 4. Execute in small, independently-verified steps

Prefer a sequence of small commits over one large diff — each commit should be a coherent, reviewable step (e.g. "extract X into its own module" then "update call sites" then "remove the old location"), matching this repo's existing Conventional Commits style (`refactor: <short description>`). This mirrors why `feature-adr` commits incrementally: it lets the user watch the structure change happen in `git log` instead of receiving one opaque diff at the end.

After each step:

- `pnpm build` — the compiler is usually the fastest signal that a move broke an import or a type.
- `pnpm lint` — catches import-sort violations (Node builtins, then external, then internal `../`) and the `.js`-extension-on-imports requirement immediately, before they compound across files.
- `pnpm test` — confirms behavior, not just types, is unchanged.

Don't batch verification to the end — if step 3 of 6 breaks something, you want to know at step 3, not after step 6 has built on top of the break.

### 5. Prove behavior is unchanged, not just "probably fine"

Before calling the refactor done:

- Run `pnpm test:bin` and check `git diff fixtures-output/` — it should be **empty** unless the refactor deliberately changes output (which would mean it's not a pure refactor; flag that to the user). This is this repo's readable, committed proof that real-file behavior didn't shift.
- Run `pnpm coverage` if the refactor moved code between test boundaries (e.g. split a file that had file-level tests), to confirm nothing silently stopped being exercised.
- Run `pnpm spell` if renames touched identifiers that also appear in comments or docs.

### 6. Stay in scope

If you notice an actual bug while reading code for the refactor, don't fix it inline — note it for the user separately. A refactor diff that also changes behavior is no longer provably behavior-preserving, which defeats the point of doing this carefully. Likewise, don't hand-edit `README.md`'s injected sections or touch `CHANGELOG.md`/version fields (release-please owned) — same boundaries `code-review` enforces.

### 7. Before opening a PR

Only push/open a PR when the user asks, confirming first via `AskUserQuestion` if it hasn't been explicit — same guardrail as `feature-adr` step 9. Note in the PR description what moved where, and point at the empty `fixtures-output/` diff (or `pnpm test:bin` result) as the behavior-preservation evidence. If step 2 put this session in a worktree, push and open the PR from there.

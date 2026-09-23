---
name: release-notes
description: 'Amend a merged PR''s Release Please release notes/changelog entry after realizing its Conventional Commit type or message was wrong — e.g. a PR merged as `fix:`/`feat:` that should have been `chore:`/`refactor:`/etc per CONTRIBUTING.md''s commit-type conventions, or a changelog line that reads confusingly. Works by editing the merged PR''s body to add a BEGIN_COMMIT_OVERRIDE/END_COMMIT_OVERRIDE block, which Release Please reads on its next run instead of the original commit message. Use this whenever the user asks to fix, override, correct, or reclassify a PR''s release notes, changelog entry, or commit message after merge, mentions BEGIN_COMMIT_OVERRIDE, or wants to audit an open Release Please release PR (title like "chore(main): release X.Y.Z") for entries that shouldn''t be under Features/Bug Fixes. Trigger even without the words "release notes" — "that PR shouldn''t have been a fix", "the changelog has some internal stuff in it", "can we reclassify #825" are all candidates. Does not rewrite git history; only changes what Release Please picks up going forward.'
---

# Release notes override

Correct a Release Please changelog entry after the PR that produced it has already merged, by editing the merged PR's body rather than the git history.

## Why this works this way

Release Please derives the version bump and changelog purely from squash-merge commit messages already in git history. Rewriting those after the fact would mean rewriting shared history and force-pushing `main` — not something to do for a miscategorized changelog line. Instead, Release Please re-reads each merged PR's **body** (not its commit) every time it scans for unreleased changes, and looks for a `BEGIN_COMMIT_OVERRIDE`/`END_COMMIT_OVERRIDE` block there. Editing a PR body is safe: no history rewrite, no force-push, and it only affects the next Release Please run — never the past.

## When to use vs. neighboring conventions

CONTRIBUTING.md's "Commits & pull requests" section governs what type a *new* PR should use going in. This skill is for the case that section is meant to prevent but sometimes doesn't catch in time: a PR already merged under the wrong type. Use this to fix the record after the fact, not as a substitute for getting the type right at merge time.

## Workflow

### 1. Determine scope: one PR, or an audit

- User names a specific PR ("fix #825's release note", "override the commit message for 812") → skip to step 3.
- User points at an open Release Please release PR (title `chore(main): release X.Y.Z`, body starting "I have created a release") → do step 2 first.

### 2. Audit a release PR's entries against CONTRIBUTING.md

Fetch the release PR's body (`gh pr view <N> --json body --jq .body`) — it's a flat changelog grouped by `### Features`, `### Bug Fixes`, etc., each line linking back to its source PR. Read this repo's CONTRIBUTING.md "Commits & pull requests" section for the current type definitions: `feat:`/`fix:` are reserved for changes to the published package's behavior; everything else (repo tooling, Claude Code skills/config, CI, lint/format config, internal restructuring, docs) is `chore:`/`refactor:`/`docs:`/`test:`/`ci:`.

For each line under Features or Bug Fixes, judge from its description whether it plausibly changes behavior a package consumer would notice. The recurring false positives are exactly what prompted this skill: adding internal tooling (a Claude Code skill, a lint ignore rule) tagged `fix:` because it was "a small change," when it never touched the published package.

Present the flagged entries with your reasoning and PR numbers, and get the user's confirmation on which (if any) to correct before touching anything. This judgment is a heuristic reading of a one-line summary, not a diff review — a human call is the right gate here, not an automatic edit.

### 3. Establish the corrected commit message

For each PR to fix, decide the corrected `type: description` (optionally `type(scope): description`, or `type!:` for breaking) using the same type list from CONTRIBUTING.md. Keep the description close to the original PR title's wording unless that was also unclear — the goal is fixing the category, not rewriting history for its own sake.

### 4. Confirm the PR was squash-merged

`BEGIN_COMMIT_OVERRIDE` only works on squash-merged PRs — Release Please can't tell which commit to apply it to on a plain merge. This repo only allows squash merges (`gh api repos/streetsidesoftware/inject-markdown --jq .allow_squash_merge` → `true`, and `.allow_merge_commit`/`.allow_rebase_merge` → `false`), so every merged PR here qualifies automatically. If this skill is ever pointed at a different repo, check its merge settings the same way before proceeding.

### 5. Edit the PR body

Fetch the current body (`gh pr view <N> --json body --jq .body`) and check whether it already has a `BEGIN_COMMIT_OVERRIDE` block:

- **No existing block**: append one at the end, on its own blank-line-separated section:
  ```
  BEGIN_COMMIT_OVERRIDE
  chore: exclude .claude/worktrees from eslint
  END_COMMIT_OVERRIDE
  ```
  Multiple messages (e.g. a PR that squashed what were really two logical changes) go one per paragraph inside the same block, each its own `type: description`.
- **Existing block**: replace its contents rather than adding a second one — Release Please reads by marker, and duplicate blocks are undefined behavior.

Preserve everything else in the body untouched — this is an append/replace of one section, not a rewrite. Show the user the new body (or a clear diff of it) before applying via `gh pr edit <N> --body "..."`. Editing a merged PR's description is visible to anyone who reads it later, so confirm first, the same as any other action visible to others.

### 6. Tell the user what happens next, and offer to trigger it

The override only takes effect the next time Release Please runs — it does not retroactively update an already-open release PR. Check `.github/workflows/release-please.yml` for `workflow_dispatch` (present in this repo); if it's there, offer to trigger it directly — `gh workflow run release-please.yml` — and point the user at the run (`gh run list --workflow=release-please.yml --limit 1`) so they can watch the release PR regenerate. Confirm before triggering, since it updates a PR other people may be watching.

Never hand-edit the release PR's body directly to "fix" an entry — it's fully regenerated from source on every run, so a direct edit is silently overwritten the next time Release Please executes. The override always goes on the *source* PR, never the release PR.

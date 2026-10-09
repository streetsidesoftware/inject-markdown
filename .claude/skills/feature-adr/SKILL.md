---
name: feature-adr
description: 'Design a new inject-markdown feature (a directive, an option, a CLI flag, a behavior change) through a structured interview, recording each decision as an ADR under docs/ADRs/<feature-slug>/ and keeping docs/glossary.md and docs/ADRs/glossary.md in sync. Use this whenever the user wants to design, spec out, or plan a feature before writing code — proposes a new @@inject option, wants to add a CLI flag, is unsure how an edge case should behave, or explicitly asks for an ADR, a design doc, or to "figure out the details" of something. Trigger even if the user doesn''t say "ADR" or "skill" by name — any request to add new behavior to this tool that has more than one reasonable interpretation is a candidate. Do not use this for pure bug fixes, refactors, or requests where the behavior is already fully specified.'
---

# Feature ADR interview

The goal is a well-designed feature. ADRs are a tool for getting there, not a deliverable.

Design inject-markdown features by interviewing the user to a fully-specified decision, recording each decision as an ADR as it firms up, and committing as you go, so you can go back to an earlier point and see how an idea evolved. Before merge, the ADRs are finalized to state the design as it stands: the trail stays in the PR's commits, and what the design work showed to be important stays in the ADRs.

This is a **design-only** workflow. Do not write or modify implementation code, tests, or `README.md` under this skill unless the user explicitly asks you to move on to implementation — a half-interviewed feature produces worse code than no code. If a question is easier to answer by trying it, a quick prototype is fine.

## Why interview before writing an ADR

Feature requests in this repo usually arrive as a one- or two-line description of _what_ ("add an option to limit rows") without the _exactly how_ (1-based or 0-based? what happens past the end of the file? does it interact with the existing `lines` option?). Writing the ADR straight from the request just moves the ambiguity into a document instead of resolving it. The interview's job is to surface every place where a reasonable engineer could implement the same request three different ways, and get the user to pick one, before that ambiguity becomes a bug report.

## Workflow

### 1. Work in a worktree while the design is in progress

Before doing anything else, use `EnterWorktree` to move the session into an isolated git worktree (name it after the feature, e.g. `row-window-adr`), and do the rest of this workflow — reading code, interviewing, writing ADRs, committing — from there. An ADR interview produces a run of small commits over what can be a long back-and-forth, and it shouldn't tie up whatever branch the user currently has checked out in their own working directory for that whole time.

Skip this step only if the session is already inside a worktree (`EnterWorktree` errors if called twice in one session — just continue in the current one) or the user has explicitly said not to bother with one for this task.

When the design work is done — the user says to move to implementation, or asks to open a PR — push the branch and open the PR from inside the worktree (see step 10), then ask whether to `ExitWorktree` with `keep` (if they might come back to extend the design before it's merged) or `remove` (once the PR is merged). This mirrors how a regular feature branch gets cleaned up after merge in this repo.

### 2. Ground yourself in the code first

Before asking anything, read the source this feature touches — don't design in the abstract. For directive/option work that's typically `src/FileInjector/Directive.ts`, `src/FileInjector/FileInjector.ts`, `src/util/hash.ts`, and `src/FileInjector/Table.ts`; for CLI-level changes, `app.mts`. Also skim `docs/ADRs/*/README.md` for prior decisions the new feature might build on, conflict with, or need to stay consistent with (naming/casing conventions, error-handling posture, 1-based indexing, etc.) — when a new decision follows or revises one in another feature, link to that feature's `README.md` and name the decision (see Links in `docs/ADRs/README.md`).

Knowing the actual code means your questions can reference real function names, existing options, and concrete edge cases instead of generic ones — that's what makes them answerable in one pass instead of triggering a round of "wait, what do you mean by X."

### 3. Interview in rounds of real decisions

Use `AskUserQuestion` for anything with more than one defensible answer. A few things that make the interview actually converge instead of dragging on:

- **Ask multiple-choice, not open-ended, whenever there's a decision.** "How should X work?" invites a paragraph; "should X do A or B?" (with the tradeoff in the description) gets a fast, comparable answer. Mark the option you'd actually pick as "(Recommended)" with a one-line reason — the user can override it, but you've saved them from having to generate an opinion from nothing.
- **Batch up to 4 related questions per call**, but don't force unrelated decisions into the same round just to fill the batch. A natural grouping (e.g. "everything about how row numbering works") reads better than four disconnected questions.
- **Anchor questions in concrete examples.** "What should `start-row=100` do on a 20-row file?" beats "how should out-of-range values be handled?" — a worked example is what actually surfaces the edge case in the user's head.
- **Don't stop at the first round.** Real specs need several passes: syntax and encoding, then selection/matching semantics, then error handling, then interaction with existing options, then formatting/display details. Each answer usually opens a new question ("okay, but what if...") — that's the interview working, not a sign to wrap up early.
- **When an answer reveals an earlier decision was wrong, revise it — don't work around it.** If a later example contradicts an already-written ADR (this has happened: a "match row 1 only" rule got reversed once a multi-row group-header example came up), go back and edit that ADR's `Decision` in place, move the old choice into `Rejected approaches` with the reasoning, add what you learned to its `Context`, and update anything downstream that referenced it (other ADRs, the glossaries). See `docs/ADRs/README.md`.

If `AskUserQuestion` rejects a call for having a question with only one real option, don't force a second option to satisfy the shape — just state the one path directly and move on.

### 4. Place the ADR correctly

Read `docs/ADRs/README.md` first — it defines the grouping convention. In short:

- A batch of ADRs deciding facets of one feature/initiative lives in `docs/ADRs/<feature-slug>/` (kebab-case), with its own `README.md` index and its own `0001`-based numbering.
- A single standalone ADR with no siblings stays flat in `docs/ADRs/`, numbered in the top-level sequence.
- Adding an ADR to an existing group means updating that group's `README.md` index; adding a new group means updating the top-level `docs/ADRs/README.md` Groups table too.

Before the first ADR of a new group, write its `README.md` from the Feature README template in `docs/ADRs/README.md`: ask why the feature is being done (and "why?" of each answer until the reason is clear), who it affects and how, what success looks like, and what's out of scope. It's a draft: revise it as the design shows a better reason.

Write each ADR from the ADR template in `docs/ADRs/README.md` (Why, Decision, Consequences, Context, Rejected approaches). The Why names the goal the decision serves and the problem it solves. The `Context` holds the background (how things are today, referencing the actual code, and approaches tried before), and `Rejected approaches` records what was rejected and why — that's what makes the ADR useful to someone who wasn't in the interview.

Restructure whenever the ADRs stop reading as one line from the Why: merge, split, or renumber them, and fix the links between them. Don't wait for the finalize step.

### 5. Keep the glossaries in sync

Whenever a decision introduces a new term that a later ADR or a future reader would need defined (a new option name, a new concept like "row window" or "header match string"), add or update its entry in the same pass, following [Glossaries](../../../docs/ADRs/README.md#glossaries) in `docs/ADRs/README.md`: new feature terms go in `docs/ADRs/glossary.md`, repo-wide concepts in `docs/glossary.md`. When you revise an ADR's decision (step 3's last bullet), check whether any glossary entry now describes the old, wrong behavior.

### 6. Commit after every file you create or edit

One commit per ADR/glossary file touched, not a batch at the end. The commits are the design's working history: they let you and the user go back to an earlier point and see how an idea evolved. They stay in the PR, so the ADRs don't need to carry that history. Use Conventional Commits (`docs: add ADR-000N <short title>`, `docs: revise ADR-000N <what changed and why>`). Don't ask permission for each commit — creating/editing files under `docs/` and committing them is the expected shape of this workflow — but do check `git status`/`git diff` before staging in case something unexpected is present.

### 7. Before treating a batch as done

Run `pnpm run spell` — new prose regularly introduces words `cspell` doesn't know (e.g. "footgun" needed adding to `cspell.config.yaml` once already). Add genuinely-fine words to the `words` list (alphabetically) rather than sprinkling `cspell:disable` comments. Also search the whole repo for links into the feature's folder (`git grep -n "ADRs/<feature>/0"` and `git grep -n "\.\./<feature>/0"`) after any rename or renumber. Links from outside the feature should point at its `README.md`, and links between its ADRs at files that exist — a broken ADR link shipped once and was caught by a Copilot PR review instead of before pushing.

### 8. Summarizing on request

If the user asks what's been decided so far, give a compact list grouped by option/decision area: the syntax, the default, and the key semantics, each linking to its ADR — not a prose retelling. They can open the ADR for the full reasoning; the summary is for orientation.

### 9. Finalize

Wait until the user says the design is final. Then rewrite the ADRs as "Finalize before merge" in `docs/ADRs/README.md` describes, including the feature README's Why, Goal, and What we learned, and commit.

Then check it with a fresh reader: start a subagent that is given only the paths of the feature's `README.md` and its ADRs. Ask it to say what gets built, why, and how the decisions fit together, and to list gaps, contradictions, and anything it had to guess. Show the user the report, and fix what they agree with.

### 10. Opening a PR

Only push/open a PR when the user asks, and confirm first via `AskUserQuestion` if it hasn't been explicit in the request — pushing and opening a PR are visible actions per this repo's usual guardrails. A small feature can ship its ADRs and implementation in one PR; ask whether the design gets its own `docs:` PR or goes in the feature's PR (see `docs/ADRs/README.md`). Note in the PR description that it's design/documentation only when no implementation is included yet. If step 1 put this session in a worktree, push and create the PR from there — no need to leave the worktree first.

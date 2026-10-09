# Architecture Decision Records

This directory records architecturally significant decisions for `inject-markdown` using short ADRs.

## Purpose

ADRs are a tool for designing a feature well. The goal is a well-designed feature, not the ADRs.

They help us work through a design one decision at a time, and the commits keep the trail while we do. Once merged, they show the design and what mattered in it: the goals, the choices, and the background behind them. They aren't a contract: when building or using the feature shows a better answer, change the design.

## Convention

- Files are named `NNNN-short-title.md`, numbered sequentially (`0001`, `0002`, ...).
- **Grouping:** when several ADRs decide facets of one feature/initiative (e.g. a batch of related options shipped together), put them in a subfolder named after the initiative (kebab-case, e.g. `table-improvements/`) with its own `README.md` index and its own `0001`-based numbering — this keeps a single feature's decisions together and stops the flat top-level list from growing noisy as unrelated ADRs accumulate over time. An ADR that doesn't belong to any such group stays flat directly in this directory, numbered in the top-level sequence.
- **Accepting.** The PR that implements an ADR also changes its `Status` from `Proposed` to `Accepted`, and updates the status in its group's index table, so no follow-up PR is needed. An ADR is accepted once the feature it decides works on `main`. Points that apply only to an option that doesn't exist yet, such as how a later `columns=` matches header names, don't hold it back. A feature never waits on another feature.
- **One PR or two.** A small feature can go in a single PR with both its ADRs and its implementation. When a design is worth reviewing before any code is written, merge it on its own with a `docs:` PR, and implement it in a later `feat:` or `fix:` PR.

## Designing a feature

### 1. Start with why

Before any decision, write the feature's `README.md` from the [template](#feature-readme): why it's being done, the stakeholders and how each is affected, the goal, and what's out of scope. Every decision is weighed against these.

They're a draft until the design is final. Revise them when the design shows a better reason, and check them again before merge.

### 2. Decide one thing at a time

- Write an ADR for each decision as it's made, and add its row to the feature's `README.md`.
- Commit each ADR as it's written. The commits let us go back to an earlier point and see how an idea evolved. They stay in the PR, so the ADRs don't need to carry that history.
- Record questions that were deferred under "Open questions" in the feature's `README.md`.
- Restructure whenever the ADRs stop reading as one line from the Why: merge, split, or renumber them, and fix the links between them. Nothing outside the feature should link to a single ADR (see [Links](#links)).

### 3. Keep the glossaries current

Add each new term as it comes up, as [Glossaries](#glossaries) describes.

### 4. Finalize before merge

When the design is final, rewrite the feature's ADRs to state the design as it stands. The timeline stays in the PR's commits. What the design work showed to be important stays in the ADRs.

- Check that the Why and the Goal in the feature's `README.md` still say why the feature is being done, and that each ADR serves a stated goal.
- Arrange the ADRs so they read as one line from the Why, with one ADR per decision that can change separately. Delete any that no longer apply, merge ADRs that only refine each other, and split ADRs that hold unrelated decisions.
- Write each ADR as the current decision, without the timeline. Keep in its Context the background and what we learned along the way, including approaches tried before. List rejected approaches briefly.
- Put what we learned about the feature as a whole in the "What we learned" section of its `README.md`.
- Renumber the feature's ADRs from `0001`, fix the links between them, and update the index. Point any link from outside the feature at its `README.md`.
- Have someone new to the design read only the feature's `README.md` and its ADRs. They should be able to say what gets built, why, and how the decisions fit together. Fix whatever they couldn't.

## Changing a merged design

Building or using a feature often shows a better answer. When it does, change the design, and update its ADRs in the same PR:

- Rewrite the ADR in place to state the current decision. Move the old choice to Rejected approaches, and add what we learned to its Context. The earlier version stays in git history.
- Delete an ADR that no longer applies, renumber the rest if needed, and fix the links between them.
- Update the feature's index, and its "What we learned" section when the change taught something about the whole feature.

## Links

Link to a feature's `README.md`, never to a single ADR file. This applies to code, docs, test fixtures, glossary entries, and other features' ADRs. Name the decision in the text, for example "the decision in [relative-links](relative-links/README.md) on what gets rebased". Only ADRs of the same feature link to each other's files, so a feature can be restructured on its own.

Some older ADRs and the table fixtures still link to single ADRs in another feature. Fix those links when either feature is finalized or changed.

## Templates

### Feature README

`docs/ADRs/<feature>/README.md`, the feature's index:

```markdown
# <Feature Name>

<One or two sentences: what this feature is and why it needed design decisions.>

## Why

- <The problem or pain that prompted this, and who has it.>
- <Why now: the request, issue, or limit that made it worth doing.>
- <Constraints that shape it.>

## Stakeholders

- **<Who>:** <what it gives them, and how it affects them (what changes, what they need to do).>

## Goal

<What success looks like: something a user can do, or output they get, that they can't today.>

## Out of scope

- <What this feature deliberately doesn't do.>

## Decisions

| ADR | Title | Status |
| --- | ----- | ------ |

## What we learned

- <Something the design work showed to be important for the whole feature, and how it shaped the design.>

## Open questions

- <Question deferred during the design, and what it's waiting on.>
```

Add one row per ADR as it's written. Fill in What we learned when the design is finalized. Remove the What we learned and Open questions sections when they're empty.

### ADR

```markdown
# ADR-NNNN: <Decision title, phrased as the thing being decided>

**Status:** Proposed | Accepted

## Why

**Goal:** <the feature goal this decision serves, and what it means for this decision.>

**Problem:** <what goes wrong today, or would without this decision.>

## Decision

<The choice that was made, stated plainly, not a summary of the discussion. Precise enough that someone can build it.>

## Consequences

<What this makes easier, what it makes harder, and what it rules out.>

## Context

<The background: how things are today and why, the constraints that apply, and the facts that shaped the choice, such as counts, measurements, examples, and approaches tried before. Keep anything that could change how someone would solve the problem.>

## Rejected approaches

- <Approach>: <why it wasn't chosen, in one line.>
```

## Glossaries

- A term introduced by one feature's ADRs goes in the [ADR glossary](glossary.md).
- A concept used across the repo goes in the main [glossary](../glossary.md).
- A term that becomes repo-wide moves from the ADR glossary to the main one, and links to it are updated.

Both glossaries use the same entry format:

```markdown
### <Term>

<Definition.> From [<feature>](<feature>/README.md).
```

- Link to the feature's `README.md`, never to a single ADR. From the main glossary the link is `ADRs/<feature>/README.md`.
- Keep entries sorted alphabetically, ignoring case, backticks and leading `--` (`--allow-env` sorts under A).
- When a term is renamed or moved, update every link to its old anchor.

## Groups

| Group                                          | Description                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [table-improvements/](table-improvements/)     | `header-rows`, `columns`, row windowing, auto-alignment, Markdown-cell, and JSON-source options for table injection                       |
| [file-access-security/](file-access-security/) | Boundary restricting which local files an `@@inject` directive may read                                                                   |
| [template-variables/](template-variables/)     | `{@ name @}` placeholder substitution in injected content, values, sources, precedence                                                    |
| [security-hardening/](security-hardening/)     | Parser denial of service, discovery boundary, remote fetch policy, `--deny-access`, threat model                                          |
| [relative-links/](relative-links/)             | Rebasing relative URLs in Markdown links, images, and definitions: in injected content, and onto `--output-dir` (`--rebase-output-links`) |

## Index (ungrouped ADRs)

_None yet — all current ADRs belong to a group above._

See also: [glossary](../glossary.md), [ADR glossary](glossary.md).

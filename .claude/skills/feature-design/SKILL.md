---
name: feature-design
description: 'Design an inject-markdown feature (a directive, a # option, a CLI flag, an API change, a behavior change) through an interview that writes a design under docs/designs/, or check a small change for side effects before it is built. Use when the user asks to design, spec, or think through a feature, asks for a design doc, or wants to figure out how an edge case should behave. Also use when the user asks to check a change for side effects. Never start it unprompted: when a change makes a public, hard-to-undo choice with more than one reasonable answer, suggest it in one line and let the user decide. Not for bug fixes, refactors, dependency updates, or fully specified changes.'
---

# feature-design

The goal is a well-designed feature. The design file is a tool for getting there, not a record to keep.

This runs the process in `docs/feature-design.md` as an interview. Read that guide first: it holds the process, the file format, and the design questions. This skill adds only how to run it.

Aim for a good design quickly, not a perfect one. If the interview drifts into detail, step back to the sketch.

## Design a feature

1. **Set up a branch.** Propose a short kebab-case slug, such as `deny-access`, and use it unless the user objects. It names the design and the branch. Check `ls docs/designs/` for an existing design first. If the session isn't already in a worktree, use `EnterWorktree` named after the slug, so the design never sits as uncommitted changes in the user's checkout. Don't push or open a PR unless asked.

2. **The why, with the user.** Look up the facts first: the issue, the code, a reproduction. Propose the why in one or two lines: who is affected, and what goes wrong for them today. Let the user correct it. If it still reads like a solution ("we need an option"), ask "why does that matter?" and redraft until it reaches the reason. Then ask, one question at a time, what success looks like and what's out of scope.

3. **Sketch.** Read `docs/design-principles.md` and `docs/glossary.md`, and look for earlier designs in `docs/designs/` and related issues. For directive and option work, read `src/FileInjector/Directive.ts`, `src/FileInjector/FileInjector.ts`, and `src/util/hash.ts`. For CLI work, read `src/app.mts`. Propose the sketch in a few lines, with one example: a directive or command line, and what inject-markdown writes. Agree on it. Then write `docs/designs/<feature>/README.md` from the guide's template, with a `WIP:` title.

4. **Walk the design questions** in `docs/feature-design.md`, one question at a time. Skip a group only when it obviously doesn't apply.
   - **The test.** A question whose answer could change the sketch, or would be hard to undo once it ships, gets discussed. For anything else, propose a default in one line and wait for a quick yes or a correction.
   - **How to ask.** Number each question, and keep each to one decision. Give options labeled (a), (b), …, each with what the user writes and what inject-markdown produces. Put your recommendation first. Check facts in the code first, and bring the result.
   - **Side remarks.** Note each in a line under Open questions and move on.
   - **Record.** Update the Design section as each point is settled. Add a turned-down option to Alternatives only when it's significant, as the guide defines it. Commit when it's useful, not per decision.

5. **Stop when the code is the easier answer.** Say so in a line, and stop. Don't start building unless asked.

6. **Settle it** when the user says the design is done. Settle or drop each open question with the user, and remove `WIP:` from the title. Run `pnpm run spell`. If the user asks for a fresh-reader check, start a subagent given only the design's path, told not to read the code. Ask it to say what the feature does, how it behaves, and why, and to list anything it had to guess or found contradictory. Show the user its report.

## Check a change

For a small feature or fix, when the user asks to check it before or while building. No design file, and a few minutes of the user's time.

1. State the change and its why in a sentence or two.
2. Check it against the design questions in `docs/feature-design.md`. List every side effect you find, with what it would change for users.
3. Raise anything that could change the approach or is hard to undo. If a hard-to-undo choice with more than one reasonable answer turns up, suggest a design in one line.

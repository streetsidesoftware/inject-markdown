# Designing a feature

A design helps you think a feature through before and while you build it. It's for whoever builds the feature, for the people who review it, and for anyone who later wants to understand it. A reader should understand the feature's intent and behavior without reading the code.

A design isn't a record to maintain. The code, the tests, and the user docs are the source of truth.

## When to write one

It's never required. Write one when you want to think before building, or when a reviewer suggests it. It's worth it when a feature makes a public choice that's hard to undo once it ships and has more than one reasonable answer:

- a new directive, or a new `#` option on a directive
- a CLI flag
- a change to what a directive injects, or to which files are read, discovered, or written
- a change to the API exported from `index.mts`

Skip it for bug fixes, refactors, dependency updates, and changes that are already fully specified.

## Where it lives

A design is a folder, `docs/designs/<feature>/`, named by a short kebab-case slug, for example `deny-access`. The design itself is its `README.md`. Research notes or a prototype can go next to it, so the design never has to move and links to it keep working.

The [designs index](designs/README.md) is generated from each design's folder name and title, so there's nothing to add there by hand.

A design can merge to main before it's settled. Start its title with `WIP:` until it is. A settled design drops `WIP:`, even when its feature isn't built yet.

Edit a design in place as it changes. Git history keeps the earlier versions, so the file doesn't have to.

A design can go in its own `docs:` PR, or in the PR that builds the feature.

## The file

```markdown
# <Feature>

## Why

<The problem, who has it, and what they can't do today. A few lines.>

## Design

<The sketch: the shape of the solution in a few lines, with one example of a directive or command line and what inject-markdown does. Then each choice that could change the sketch or is hard to undo, with the alternatives turned down and why.>

## Open questions

- <A side question or deferred point, in one line.>
```

Record what's out of scope only when a reader would otherwise assume the feature covers it.

Don't state another feature's build status in a design. Link to its design or user docs instead, so the sentence can't go stale.

Define a new term where it's first used. If it's used across the repo, add it to the [glossary](glossary.md).

## How to design

Work from the top down, and stop when the code is the easier way to answer the rest.

1. **Get to the why.** A feature often starts as a solution ("we need an option"). Ask "why?" until you reach the problem: who is affected, and what goes wrong for them today. Look at the issue and the code first, so the why rests on facts.
2. **Sketch the design** in a few lines, with one example.
3. **Work through the [design questions](#design-questions).** Spend time on a question when its answer could change the sketch, or would be hard to undo once it ships. Settle anything else with a sensible default. When a detail shows the sketch is wrong, change the sketch.
4. **Note side questions** in a line under Open questions, and move on.
5. **Let the code settle the rest.** When a question is easier to answer by building or trying something, stop designing and build.

When the feature ships, update the design where building it changed the design. After that, leave it alone. When a later change makes it wrong, the code and the docs win.

If a design sets a rule that holds beyond its feature, add it to the [design principles](design-principles.md).

## Design questions

Go through the groups that apply.

### Who it affects

- people writing `@@inject` directives in their Markdown
- people running the CLI, locally and in CI
- projects calling the API (`injectFile`, `injectMarkdown`, `removeDirectives`)
- readers of the generated documents, on GitHub, npm, or a docs site
- maintainers of this repo

### Rules the design has to fit

Check each one in the code rather than assuming it.

- **Option encoding:** directive options live in the `#` fragment of the file reference and are parsed by `parseHashString` in `src/util/hash.ts`.
- **CLI and API:** every CLI option in `app.mts` has a matching field in the `Options` and `FileInjectorOptions` interfaces.
- **The injection root:** local reads stay inside it, and file discovery is bounded by it.
- **Formatting:** an injection pass keeps a file's existing Markdown style (`detectMarkdownStyle`).
- **The [design principles](design-principles.md).**

### Where hard-to-undo choices hide

- **Name.** Does it collide with, or read as a synonym of, an existing option or flag?
- **Shape.** A flag often becomes a value later. Would a value leave room to grow?
- **Default.** Does it change the output of any existing document?
- **Directive versus run-wide.** Can it be set per directive, on the command line, or both? Which wins when both are set?
- **Interactions.** How does it combine with `lines`, `heading`, `code`, `quote`, table options, template variables, and link rebasing?
- **`--clean` and `--dry-run`.** What do they do with it?
- **Errors.** What does a user see when it's misused: a fatal error, or an error comment in the document?
- **Paths.** Does it work with Windows paths, and with remote (GitHub) files?

### Testing and release

- Which tests cover it? Does it need a fixture under `fixtures/`?
- Is it `feat:` or `fix:`, and is it breaking? What does the release note say?
- Which docs change: the README (through `content/README.md`), a guide in `docs/guide/`, `SECURITY.md`?

## With Claude Code

The `feature-design` skill runs this as an interview. It can also check a small change for side effects before it's built.

# Contributing to inject-markdown

[![unit tests](https://github.com/streetsidesoftware/inject-markdown/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/streetsidesoftware/inject-markdown/actions)
[![lint](https://github.com/streetsidesoftware/inject-markdown/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/streetsidesoftware/inject-markdown/actions)
[![codecov](https://codecov.io/gh/streetsidesoftware/inject-markdown/branch/main/graph/badge.svg?token=Dr4fi2Sy08)](https://codecov.io/gh/streetsidesoftware/inject-markdown)
[![Coverage Status](https://coveralls.io/repos/github/streetsidesoftware/inject-markdown/badge.svg?branch=main)](https://coveralls.io/github/streetsidesoftware/inject-markdown)

Notes for maintainers and contributors working on this codebase. For CLI/library usage docs, see [README.md](README.md).

## Getting started

- Requires Node.js >= 22.
- The package manager (pnpm) is pinned via corepack. Run `corepack enable` once per terminal session, then use `pnpm <cmd>` directly.

## Development commands

```sh
pnpm install     # install dependencies
pnpm build       # tsc -p . -> dist/
pnpm watch       # tsc --watch
pnpm lint        # eslint + prettier (check only)
pnpm lint:fix    # eslint --fix + prettier --write
pnpm test        # vitest run --pool=forks
pnpm test:watch  # vitest (watch mode)
pnpm coverage    # vitest run --coverage
pnpm spell       # cspell spell-check
```

Always run `lint`, `build`, and `test` before opening a PR.

Run a single test file or test case with vitest directly:

```sh
pnpm vitest run src/FileInjector/FileInjector.test.ts
pnpm vitest run -t "test name substring"
```

Test files live at `src/**/*.test.{ts,mts}`; snapshots are in `src/**/__snapshots__/`.

Integration-style test against real fixture files: `pnpm test:bin` (runs the built CLI over `fixtures/`, writing to `fixtures-output/`).

`fixtures-output/` is committed. It is the rendered result of a real run, so a change in behavior shows up as a readable Markdown diff in the pull request rather than as an escaped blob inside a `.snap` file — which is the point of keeping it. Regenerate it with `pnpm test:bin` and commit the result alongside the change that caused it; `autofix.ci` regenerates and commits it on a pull request if you forget. Prettier ignores the directory (see `.prettierignore`) so the formatter never rewrites what the tool produced.

The `injection-root-boundary/` fixtures are excluded from that run. They test a boundary that is relative to the injection root, so they are only meaningful under their own narrower `--cwd`; processed under `fixtures/` the "outside" directory is inside the root, and the output would show a secret being injected legitimately while reading as a security failure. They are covered by `FileInjector.test.ts` instead, which sets the root they need.

## Updating README.md

`README.md` is itself built by `inject-markdown` from files in `content/` and `static/`. Never edit content between `<!--- @@inject: ... --->` and `<!--- @@inject-end: ... --->` markers directly in `README.md`. Edit the source in `content/` or `static/`, then regenerate:

```sh
pnpm build:readme   # ./scripts/update_readme.sh
```

The script writes `content/help.txt` from `--help`, hydrates every file under `content/`, then hydrates `README.md`. The GitHub recipe fetches from github.com, so it needs network access.

### Where things live

- `README.md`, outside the markers — hand-edited: title, pitch, Why, the Reference links and the `<details>` wrapper around `--help`.
- `content/README.md` — Quick start through Recipes. It has no H1; its sections are `##`.
- `content/import-sample-*.md`, `quickstart.md` — one directive each, hydrated in place and shown as code by `content/README.md`.
- `content/*` other files — the source files those directives inject (`code.ts`, `sample.csv`, …).
- `docs/guide/*.md` — hand-written user guides for rules too detailed for the README. Not generated.
- `static/footer.md` — the footer.

### Adding a recipe

Recipes show the real output of a directive rather than a hand-written copy, so the example can't drift from the tool's behavior:

1. Add `content/import-sample-<name>.md` containing just the directive, e.g. `<!--- @@inject: code.js#L5-L7 --->`.
2. In `content/README.md`, show it with `<!--- @@inject-code: import-sample-<name>.md --->`. For output that should also render (tables, for example), add a plain `@@inject` of the same file after it.
3. Run `pnpm build:readme` and commit the hydrated sample files along with `README.md`.

### Documenting a new feature

- Add a row to the **Directives** or **Injection options** table in `content/README.md`.
- Add a recipe if the feature has a visible effect.
- Put detailed rules (precedence, edge cases) in `docs/guide/` and link to it from the README, rather than growing the README.

Links in `content/README.md` are written relative to the repository root (e.g. `docs/guide/...`), because they're read from the root `README.md`. They don't resolve when viewing `content/README.md` itself.

## Architecture

```
src/
  app.mts                   CLI entry point (commander-based option parsing)
  FileInjector/              Core injection logic
    FileInjector.ts          Main class: parses Markdown (via remark), resolves & injects files
    Directive.ts              Parses @@inject HTML comment directives
    Markdown.ts               mdast generation/manipulation helpers (code blocks, quoting, heading extraction, errors)
    Table.ts                  Builds a GFM table mdast node from parsed CSV/TSV rows
    VFileEx.ts                Extends vfile's VFile with injection metadata; isVFileEx() type-narrows
    utils.ts                  Error conversion helpers
  FileSystemAdapter/          Abstraction over Node's fs (for testability)
    FileSystemAdapter.ts      Interface definition
    fsa.ts                    Node.js fs implementation (nodeFsa()) — used in production
    fsStore.mts               In-memory fs implementation — used in tests
  processor/
    process.mts               processGlobs(): orchestrates file discovery (globby) and injection
    reportFileErrors.mts      Formats per-file error messages
  reporting/
    formatSummary.mts          Formats the CLI summary line
  util/                       Shared helpers (URL parsing, hash/fragment parsing, file type detection, CSV/TSV parsing)
bin.mjs                       CLI shim invoking the built src/app.mts
dist/                         Compiled output (generated; not committed)
fixtures/, fixtures-output/   Integration-test input/expected-output pairs
content/, static/, sample-clean/, sample-hydrated/   README source snippets and hydration samples
```

Data flow: `app.mts` parses CLI options -> `processGlobs()` (in `process.mts`) globs for `.md` files and, for each, calls `FileInjector.processFile()` -> `FileInjector` parses the file with the `remark` pipeline (`remarkParse` + `remarkGfm` + `remarkStringify`), walks the AST for HTML comment nodes, parses each via `parseDirective`, resolves the referenced file/URL, and injects/replaces content -> results are aggregated into a summary reported via `formatSummary.mts`.

Key abstractions:

- **`FileSystemAdapter`**: interface wrapping `fs` operations. Production uses `nodeFsa()`; tests use the in-memory `fsStore`. Inject this adapter rather than calling `fs` directly in new code.
- **`VFileEx`**: extends `vfile`'s `VFile` with fields tracking injections, errors, and source data.
- **`parseDirective`**: parses a raw HTML comment string into a `Directive` (`type`, `file`).
- **`parseHash`**: parses the `#fragment` of a file reference into `InjectInfo` (`heading`, `lang`, `quote`, `code`, line range).

## Code style

- Pure ESM (`"type": "module"`, `NodeNext` module/resolution). Imports must use explicit `.js` extensions even for `.ts`/`.mts` source files.
- Source files use `.mts` or `.ts`; compiled output is `.mjs` in `dist/`.
- TypeScript is strict (`strict`, `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). `@typescript-eslint/no-explicit-any` is a lint warning — avoid `any`. Explicit function return types are not required/enforced.
- Imports are sorted by `eslint-plugin-simple-import-sort` (Node builtins, then external packages, then internal `../` imports) — sorting is a lint error, not just style.
- Unused parameters are prefixed with `_` (e.g. `_command`) to satisfy `noUnusedParameters`.
- Formatting follows `.prettierrc.json` and `.editorconfig`; `pnpm prettier`/`prettier:fix` (bundled in `lint`/`lint:fix`) enforce it.

## Commits & pull requests

Keep commits focused and describe the _why_ in the commit message, not just the _what_.

Follow [Conventional Commits](https://www.conventionalcommits.org/). Release Please derives the version bump and changelog from the type, so pick it by user-facing impact, not by how much code changed:

- `feat:` — a feature or other change a user of the published package would notice.
- `fix:` — a bug fix that changes published behavior.
- `feat!:` / `fix!:` — either of the above, but breaking.
- `refactor:` — internal restructuring with no behavior change.
- `docs:` — documentation only (README, ADRs, CONTRIBUTING.md, etc.).
- `test:` — test-only changes.
- `ci:` — GitHub Actions/workflow changes, including automated dependency bumps.
- `chore:` — everything else that doesn't touch published behavior: repo tooling, Claude Code skills/config, dev dependencies, lint/format config, etc.

Repo maintenance and internal restructuring are never `fix:`/`feat:`, even for a large diff — those two are reserved for changes to the published package's behavior, because `fix:`/`feat:` are what show up in the changelog and bump the version.

If a PR merges under the wrong type, see the `release-notes` Claude Code skill for correcting the entry after the fact via a `BEGIN_COMMIT_OVERRIDE` block, rather than rewriting history.

### PR descriptions

Keep PR descriptions short — no one reads a long one. Prefer bullet points over prose paragraphs; a sentence packed with more than one or two `inline code` spans is hard to parse — break it into a list instead.

Use `##` headings to break up sections rather than running everything together as prose — one for each part below that applies.

- `## Summary` — a one- or two-sentence TL;DR that stands on its own: what changed and why, in plain prose. It should be readable without anything that follows, not a fragment a later section completes. If the why needs more room than that, give it its own sentence or two right after.
- `fix:` and `feat:` PRs are user-facing and feed release notes — write for a reader deciding whether a change affects them, not for a reviewer reviewing the diff.
  - For `feat:` PRs, add a `## Feature` heading with a short paragraph on the feature itself: what it lets the user do that they couldn't before, and — where it shapes how they should think about using it — why it was designed that way (e.g. why it's opt-in, why this precedence order).
- `refactor:`/`chore:` PRs are for reviewers, not release notes, so implementation detail belongs here rather than being trimmed out — but keep it to the _what_ and _why it matters to a reviewer_, not a mechanical _how_ or a narration of the steps taken to get there. Group by theme (what changed, not which file it lives in) — label each group with a short effect/topic phrase, e.g. `**Hidden refactors**`, not a file path like `**release-please-config.json**`. A single-item group reads fine as a short paragraph after its label; only reach for bullets under a label when the group covers several distinct changes. Not `<details>`-gated, since a reviewer needs to see it to review the PR. A `##`/`###` heading or a bold label (`**Topic**` on its own line before the paragraph/bullets) both work; use a bold label when a full heading would be heavier than the group needs.
- If needed, further detail in `<details>` blocks (e.g. `<summary>Usage</summary>`, `<summary>Details</summary>`), as bullet points, not prose paragraphs — these stay collapsed, unlike the `##` headings above, so lead with what actually needs a click.
  - Usage should include changes to the command line options and/or `@@inject` directives. Adding an example or two would be great.
- No test plan section — CI covers that.

Do not:

- Restate the diff or narrate file-by-file changes.
- Narrate the process of arriving at the change (where content was copied from, exploration or dead ends, which attempt fixed what) — describe the resulting change and why it matters, not the journey there.
- On `fix:`/`feat:` PRs, explain internal implementation, refactors, or code structure the user doesn't interact with — that's what `refactor:`/`chore:` PRs are for.
- Add tables, code walkthroughs, or before/after examples for internal behavior.
- Compress the TL;DR into a bare fragment or list of renamed symbols that only makes sense once you've read the bullets below it.
- Add auto-generated links back to individual diff hunks or lines (e.g. `[[1]]`/`[[2]]` permalinks) — the diff is already there for anyone reviewing.
- Write a separate section per commit or sub-change — one TL;DR covers the whole PR.

## CI & releases

- `.github/workflows/test.yml` runs unit tests and `lint.yml` runs linting on PRs.
- Releases are automated by Release Please (`release-please-config.json`, `.release-please-manifest.json`).

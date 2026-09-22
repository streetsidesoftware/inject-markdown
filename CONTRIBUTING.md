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

Follow Conventional Commits:

- `fix:` — small changes and bug fixes that change published code.
- `feat:` — features and other larger changes.
- `chore:` — CI/CD or dependency-related changes.

## CI & releases

- `.github/workflows/test.yml` runs unit tests and `lint.yml` runs linting on PRs.
- Releases are automated by Release Please (`release-please-config.json`, `.release-please-manifest.json`).

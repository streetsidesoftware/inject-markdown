# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`inject-markdown` is a Node.js CLI tool and library that injects file content into Markdown files via `@@inject` HTML-comment directives, keeping generated docs (like this repo's own `README.md`) in sync with their source files.

Directives:

- `<!--- @@inject: <file> --->` — injects a file's content (Markdown inline, non-Markdown as a code block).
- `<!--- @@inject-code: <file> --->` — always injects as a code block.
- `<!--- @@inject-start: <file> --->` — alias for `@@inject`.
- `<!--- @@inject-end: <file> --->` — closes an injected section.
- The `#` fragment of the file reference sets per-injection options: `heading=`, `lang=`, `code`, `quote`, `L1-L10` (line range).

## Commands

Run `corepack enable` once per terminal session (the package manager, pnpm, is pinned via corepack). After that, use `pnpm <cmd>` directly.

```sh
pnpm build       # tsc -p . -> dist/
pnpm watch       # tsc --watch
pnpm lint        # eslint + prettier (check only)
pnpm lint:fix    # eslint --fix + prettier --write
pnpm test        # vitest run --pool=forks
pnpm test:watch  # vitest (watch mode)
pnpm coverage    # vitest run --coverage
pnpm spell       # cspell spell-check
```

Always run `lint`, `build`, and `test` after making changes.

Run a single test file or test case with vitest directly, e.g.:

```sh
pnpm vitest run src/FileInjector/FileInjector.test.ts
pnpm vitest run -t "test name substring"
```

Requires Node.js >= 22.

Test files live at `src/**/*.test.{ts,mts}`; snapshots are in `src/**/__snapshots__/`.

Integration-style test against real fixture files: `pnpm test:bin` (runs the built CLI over `fixtures/`, writing to `fixtures-output/`).

## `README.md` is generated — do not hand-edit injected sections

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
  util/                       Shared helpers (URL parsing, hash/fragment parsing, file type detection)
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

## Conventions specific to this repo

- Pure ESM (`"type": "module"`, `NodeNext` module/resolution). Imports must use explicit `.js` extensions even for `.ts`/`.mts` source files.
- Source files use `.mts` or `.ts`; compiled output is `.mjs` in `dist/`.
- TypeScript is strict (`strict`, `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). `@typescript-eslint/no-explicit-any` is a lint warning — avoid `any`. Explicit function return types are not required/enforced.
- Imports are sorted by `eslint-plugin-simple-import-sort` (Node builtins, then external packages, then internal `../` imports) — sorting is a lint error, not just style.
- Unused parameters are prefixed with `_` (e.g. `_command`) to satisfy `noUnusedParameters`.
- Formatting follows `.prettierrc.json` and `.editorconfig`; `pnpm prettier`/`prettier:fix` (bundled in `lint`/`lint:fix`) enforce it.
- Only `.md` files are processed (enforced in `process.mts`); remote files (GitHub blob URLs) are fetched via `node-fetch`, local files go through `FileSystemAdapter`.
- Directive matching is two-step: a quick regex pre-filter (`directiveRegExp`), then a full parse via `parseDirective` — both must pass for a comment to be treated as a directive.
- The remark stringify options (bullet style, fence char, etc.) are fixed constants to keep round-tripped Markdown output consistent — don't change them casually.
- `--clean` removes injected sections but keeps the directive comment markers; `--dry-run` processes/reports without writing.
- Adding a new CLI option requires registering it in `app.mts` *and* adding it to the `Options`/`FileInjectorOptions` interfaces.
- PR commit style follows Conventional Commits: `fix:`, `feat:`, `chore:` (releases are automated via release-please).
- CI runs `.github/workflows/test.yml` (unit tests) and `lint.yml` (linting) on PRs; releases are managed by Release Please (`release-please-config.json`, `.release-please-manifest.json`).

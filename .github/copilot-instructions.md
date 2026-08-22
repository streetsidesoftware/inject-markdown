# Copilot Instructions for inject-markdown

## Project Overview

`inject-markdown` is a Node.js CLI tool (and library) that injects file content into Markdown files using special HTML comment directives. Developers annotate their Markdown with `@@inject` comments and then run the tool to populate those sections automatically, keeping documentation in sync with source files.

Key directives:
- `<!--- @@inject: <file> --->` – injects a file's content (Markdown inline, non-Markdown as a code block).
- `<!--- @@inject-code: <file> --->` – always injects as a code block.
- `<!--- @@inject-start: <file> --->` – alias for `@@inject`.
- `<!--- @@inject-end: <file> --->` – closes an injected section.
- The `#` fragment of the URL sets options: `heading=`, `lang=`, `code`, `quote`, `L1-L10` (line ranges).

## Repository Layout

```
src/                        TypeScript source (compiled to dist/)
  app.mts                   CLI entry point (commander-based)
  FileInjector/             Core injection logic
    FileInjector.ts         Main class: parses Markdown, resolves & injects files
    Directive.ts            Parses @@inject HTML comment directives
    VFileEx.ts              Extended VFile with injection metadata
    utils.ts                Error conversion helpers
  FileSystemAdapter/        Abstraction over Node's fs (for testability)
    FileSystemAdapter.ts    Interface definition
    fsa.ts                  Node.js fs implementation
    fsStore.mts             In-memory fs implementation (used in tests)
  processor/
    process.mts             processGlobs(): orchestrates file discovery and injection
    reportFileErrors.mts    Formats per-file error messages
  reporting/
    formatSummary.mts       Formats the CLI summary line
  util/                     Shared helpers (URL, hash parsing, file type detection)
bin.mjs                     CLI shim (calls src/app.mts after build)
dist/                       Compiled output (generated; not committed)
fixtures/                   Input Markdown files used for integration tests
fixtures-output/            Expected output of running the tool on fixtures
content/                    Injected content snippets (e.g., help.txt, README.md)
sample-clean/               Clean (un-hydrated) sample Markdown files
sample-hydrated/            Hydrated (injected) sample Markdown files
```

## Language & Module System

- TypeScript with strict settings (`strict`, `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Pure ESM: `"type": "module"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.
- Source files use `.mts` or `.ts` extensions; imports must use explicit `.js` extensions (NodeNext resolution).
- Compiled output goes to `dist/` as `.mjs` files.
- Node.js ≥ 22 required.
- Package manager: `pnpm` (managed via `corepack`). Always use `corepack pnpm <cmd>`.

## Build, Lint, and Test

```sh
corepack pnpm build       # tsc -p . → dist/
corepack pnpm lint        # eslint + prettier (check only)
corepack pnpm lint:fix    # eslint --fix + prettier --write
corepack pnpm test        # vitest run --pool=forks (src/**/*.test.{ts,mts})
corepack pnpm coverage    # vitest run --coverage
corepack pnpm spell       # cspell spell-check
```

Always run `lint`, `build`, and `test` after changes to verify correctness.

## Code Conventions

- **Imports**: sorted by `eslint-plugin-simple-import-sort`. Node built-ins first, then external packages, then internal (`../`). Failing to sort is a lint error.
- **Unused parameters**: prefix with `_` to silence the lint rule (e.g., `_command`).
- **No `any`**: `@typescript-eslint/no-explicit-any` is a warning; avoid it.
- **Explicit return types**: not required (`explicit-function-return-type` is off).
- **File extensions in imports**: always use `.js` (or `.mjs`) even when the source file is `.ts`/`.mts` – required by NodeNext module resolution.
- **Prettier**: enforced on all files. Run `prettier -c .` to check. Config in `.prettierrc.json`.
- **EditorConfig**: respected; follow `.editorconfig` for indentation and line endings.

## Testing

- Framework: Vitest.
- Test files: `src/**/*.test.ts` and `src/**/*.test.mts`.
- Tests use the in-memory `fsStore` (`FileSystemAdapter`) for isolation rather than hitting the real filesystem where possible.
- Snapshot tests are stored in `src/**/__snapshots__/`.
- The `fixtures/` and `fixtures-output/` directories are used for integration-style testing via `pnpm test:bin`.

## Key Abstractions

- **`FileSystemAdapter`**: an interface wrapping `fs` operations. Production code uses `nodeFsa()`; tests use `fsStore`. Always inject this adapter rather than calling `fs` directly in new code.
- **`VFileEx`**: extends `vfile`'s `VFile` with extra fields tracking injections, errors, and source data. Use `isVFileEx()` to type-narrow.
- **`parseDirective`**: parses a raw HTML comment string into a `Directive` (`type`, `file`). Used by `FileInjector` when walking AST HTML nodes.
- **`parseHash`**: parses the `#fragment` of a file URL into `InjectInfo` (`heading`, `lang`, `quote`, `code`, line range).

## Common Gotchas

- The tool only processes `.md` files (enforced in `process.mts`).
- Remote files (GitHub blob URLs) are fetched via `node-fetch`; local files are read through the `FileSystemAdapter`.
- Directive matching uses a two-step approach: a quick regex pre-filter (`directiveRegExp`) then full parse via `parseDirective`. Both must pass.
- The `remark` pipeline (`remarkParse` + `remarkGfm` + `remarkStringify`) is used to round-trip Markdown. The output options (bullet `-`, fence `` ` ``, etc.) are fixed constants to keep output consistent.
- `--clean` mode removes all injected sections but keeps the directive comment markers.
- `--dry-run` processes and reports without writing any files.
- When adding a new CLI option, register it in `app.mts` and add it to the `Options`/`FileInjectorOptions` interfaces.

## CI / Workflows

GitHub Actions workflows live in `.github/workflows/`. The main workflows are `test.yml` (runs unit tests) and `lint.yml` (runs linting). Releases are managed by Release Please (`release-please-config.json`, `.release-please-manifest.json`).

## README / Documentation Maintenance

`README.md` is itself injected via `inject-markdown`. Do **not** manually edit the injected sections (between `@@inject` and `@@inject-end` markers). Edit the source files in `content/` or `static/` instead, then regenerate with:

```sh
pnpm build:readme   # ./scripts/update_readme.sh
```

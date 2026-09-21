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

## Development setup, commands, architecture, and conventions

See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup (Node/corepack), build/lint/test commands (including running a single test), the codebase architecture (source layout, data flow, key abstractions), how `README.md` is generated (don't hand-edit its injected sections), code style, and commit/PR/CI conventions.

## Writing comments

Assume an expert-programmer reader. Keep comments succinct — 1-2 lines. Cover What and, where non-obvious, Why; only explain How if it isn't already obvious from the code.

## Code-specific gotchas

- Only `.md` files are processed (enforced in `process.mts`); remote files (GitHub blob URLs) are fetched via `node-fetch`, local files go through `FileSystemAdapter`.
- Directive matching is two-step: a quick regex pre-filter (`directiveRegExp`), then a full parse via `parseDirective` — both must pass for a comment to be treated as a directive.
- The remark stringify options (bullet style, fence char, etc.) are detected per-file from the source document (`detectMarkdownStyle` in `detectStyle.ts`), falling back to fixed defaults for constructs the file doesn't use — this preserves a file's existing formatting across an injection pass instead of normalizing it.
- `--clean` removes injected sections but keeps the directive comment markers; `--dry-run` processes/reports without writing.
- Adding a new CLI option requires registering it in `app.mts` _and_ adding it to the `Options`/`FileInjectorOptions` interfaces.
- Imports must use explicit `.js` extensions even for `.ts`/`.mts` source files (NodeNext ESM resolution) — see [CONTRIBUTING.md](CONTRIBUTING.md) for full code style rules.

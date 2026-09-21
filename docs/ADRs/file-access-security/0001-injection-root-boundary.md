# ADR-0001: Injection-root boundary for local file reads

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Jason Dent

## Context

`@@inject`/`@@inject-code`/`@@inject-table` directives resolve their file reference relative to the Markdown file containing them, via `RelURL.toUrl()` in `src/util/url_helper.ts` (`fsPath.resolve(baseDir, this.pathname)`), then read the result unconditionally through `FileSystemAdapter.readFile` (`src/FileSystemAdapter/fsa.ts`). Nothing bounds the resolved path today: `../../.env`, an absolute path like `/etc/passwd`, or a symlink inside the tree pointing outside it all resolve and get read exactly like a legitimate relative reference, and their contents are spliced into the processed document by `injectContent` in `src/FileInjector/FileInjector.ts`.

This matters because `inject-markdown` is typically run over documentation that gets regenerated from PRs, often by CI with real secrets in its environment. A directive is just text in a Markdown file — anyone who can open a PR touching a processed `.md` file can add one, and whoever runs the tool will silently embed the referenced file's content into the generated output, which then usually gets committed or published.

Every documented/legitimate use of `@@inject` (see `README.md`) references files within the same project tree, relative to the referencing document. There's no existing concept of a trust boundary for local file reads.

## Decision

Every local (`file:`) directive-file reference must resolve to a path inside the **injection root** — the directory identified by `FileInjectorOptions.cwd` (the same option and default, `process.cwd()`, already used for `--cwd`, relative-path reporting, and `--output-dir`; no new default to compute). The check:

1. Resolves the directive's file reference to an absolute path, as today.
2. Resolves both that path and the injection root through `fs.realpath`, closing the symlink-escape case: a symlink inside the root pointing outside it (e.g. `docs/link-to-etc` → `/etc`) is caught because its real path falls outside the root.
3. Rejects the reference if its real path is not equal to, or inside, the real injection root.

A rejected reference is a fatal error on the `VFile`, reported and handled exactly like today's "Failed to read" failure in `resolveAndReadFile` (respects `--stop-on-errors` / `--write-on-error`) — from the processing pipeline's point of view, a file outside the root doesn't exist.

This check applies only to local file references. Remote (`http(s)`) fetches in `fsa.ts` are unaffected — out of scope for this decision; see [../README.md](../README.md) Groups description.

## Options Considered

- **Denylist of sensitive filename patterns** (`.env*`, `*.pem`, `id_rsa*`, `.git/`, ...) instead of or alongside a boundary root — rejected: an unbounded, never-complete list of patterns still permits reading anything an escape like `../../../etc/passwd` reaches that no pattern happens to name. The boundary root closes the actual exposure (reading anything outside the intended tree) without trying to enumerate what's sensitive.
- **Auto-detected git-repo root** instead of `cwd` — rejected: adds a new detection mechanism (walk up for `.git`) and a dependency on running inside a git repository, when `cwd` is already the tool's existing anchor for relative-path reporting and `--output-dir`.
- **Textual-only path check (no realpath/symlink resolution)** — rejected: a symlink inside the root pointing outside it would bypass a purely textual `..`/absolute-path check, defeating the boundary for a repo containing such a symlink, whether placed deliberately or by accident.

## Consequences

- Breaking change: any existing user relying on injecting from outside `cwd` (deliberately or not) gets a fatal error after upgrading. Shipped as part of a semver-major bump; see [ADR-0003](0003-rollout-as-major-version-bump.md).
- An escape hatch is needed for legitimate outside-root references (e.g. monorepo sibling packages) — see [ADR-0002](0002-injection-root-escape-hatch.md).
- Every call site that resolves a directive's file URL to a local path (`readAndParseMarkdownFile`, `readAndParseCodeFile`, `readAndParseTableFile`) funnels through the shared `resolveAndReadFile` in `src/FileInjector/FileInjector.ts` — the check belongs there once, not duplicated per call site.
- `fs.realpath` requires the path to exist; a reference that is both outside the root _and_ nonexistent still needs a sensible error (existing "Failed to read" wording covers this — an implementation detail, not a new user-facing distinction).

# ADR-0002: The injection root bounds file discovery, not only directive reads

**Status:** Proposed
**Date:** 2026-09-22
**Deciders:** Jason Dent

## Context

[file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) bounds the files a **directive** may read. It says nothing about the set of files the tool **processes**, which `findFiles` in [process.mts](../../../src/processor/process.mts) builds with `globby`:

```ts
const options: Mutable<GlobbyOptions> = {
  ignore: excludes, // ['node_modules']
  onlyFiles: true,
  cwd: cwdToUse
};
```

`followSymbolicLinks` is not set, and `fast-glob` defaults it to `true`, so a symbolic link to a directory outside the tree is traversed. With `link -> ../elsewhere` inside the root:

```
globby(['**/*.md'], { cwd: root })  →  [ 'link/doc.md' ]
```

`doc.md` is then processed like any other file. Without `--output-dir`, `writeResult` writes back to the file's own URL, so the rewrite lands outside the injection root. The directive boundary does not help: it constrains what `doc.md` may read, not whether `doc.md` should have been in the working set at all.

The exposure is narrower than the one ADR-0001 closes — it needs a planted symbolic link with a `.md` file behind it, and it rewrites rather than discloses. But a boundary that covers reads and not writes is an odd shape to leave in place, and the fix reuses machinery that already exists.

## Decision

Apply the injection root to discovered files as well as to directive references.

1. After globbing, drop any discovered path whose `realpath` falls outside the injection root, using the same containment test as the directive boundary.
2. Keep following symbolic links during traversal. A symlinked directory that stays inside the root is a layout some repositories use deliberately, and it keeps working; only paths that actually leave the root are dropped.
3. Apply the filter **only to the results of a dynamic pattern**. A pattern with no glob metacharacters — `inject-markdown ../other/README.md` — is an explicitly named file and is processed even when it resolves outside the root. `globby`'s `isDynamicPattern` makes the distinction. An operator naming a file is not the untrusted input this boundary defends against; the directives inside that file are, and those remain bounded by ADR-0001 regardless of where the file itself lives.
4. Drop silently, as the existing `node_modules` entry in `excludes` does. A dropped path is not part of the set the operator asked for, and no document in the run refers to it, so there is nothing to attach a message to.
5. `--allow-outside-root` does **not** widen the discovery set. It names directories a directive may _reference_; letting it also expand which files get _rewritten in place_ would overload one flag with two different grants.

The two-gate ordering that [file-access-security/ADR-0001](../file-access-security/0001-injection-root-boundary.md) requires for directive references is not needed here. That ordering exists so a denial cannot reveal whether a path exists; every discovered path exists by construction, and nothing about the drop is reported, so there is no signal to leak.

## Options Considered

- **Set `followSymbolicLinks: false`** — rejected: a one-line change, but it also stops traversing a symlinked directory that never leaves the root, breaking layouts that are both legitimate and safe. Filtering on the realpath distinguishes the two cases; refusing to follow links at all does not.
- **Apply the boundary to explicitly named files too** — rejected: a single rule is easier to explain, but it breaks `inject-markdown ../other/README.md`, which works today and exposes nothing the operator could not already reach. It would also force `--allow-outside-root` to grow a second meaning, per point 5.
- **Warn on each dropped path** — rejected: a symlink leaving the tree is a layout choice, not an incident, and the warning would fire on every run for a repository that has one.
- **Leave it and document it** — rejected: the escape is confined to `findFiles`, and the containment test already exists.

## Consequences

- Every file the tool rewrites in place now sits inside the injection root, matching the guarantee already made about reads.
- A repository whose working set genuinely reaches outside the root through a symbolic link must name those files explicitly, or run a second pass with a `--cwd` that contains them. There is no flag for it, by point 5.
- `findFiles` gains a `realpath` call per discovered file. That is one `stat`-class syscall per `.md` file in the tree, on a code path that has already walked the same directories.
- The containment test moves somewhere both `FileInjector` and `process.mts` can reach it. It currently lives as a module-private `isWithinRoot` in [FileInjector.ts](../../../src/FileInjector/FileInjector.ts).

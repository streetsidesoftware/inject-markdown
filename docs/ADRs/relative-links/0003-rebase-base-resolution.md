# ADR-0003: Resolving a rebased URL: local sources, remote sources, and `--output-dir`

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

Rebasing a relative URL ([ADR-0001](0001-rebase-scope.md)) takes two bases: the location the URL was written against (the source file), and the location it will be read from (the host file). Three cases need a decision:

- **Local source.** `dFile.toUrl(fileUrl)` in `injectMarkdownFile` ([FileInjector.ts](../../../src/FileInjector/FileInjector.ts)) resolves the directive's reference against the host file. `resolveWithinInjectionRoot` may then swap it for a symlink-resolved real path before reading.
- **Remote source.** A reference like `https://github.com/o/r/blob/main/docs/x.md` is fetched from `raw.githubusercontent.com` by `mapUrl` in [fsa.ts](../../../src/FileSystemAdapter/fsa.ts). A relative path from a local host file can't reach a remote file at all.
- **`--output-dir`.** `determineTargetPath` writes the host file to `<output-dir>/<path relative to cwd>`, so the written file may sit somewhere other than the source host file.

## Decision

1. **Local source: relative to the host file's source location.** The rebased URL is the path from the host file's directory to the target, where the target is the original relative URL resolved against the injected file's URL _as written in the directive_ (`dFile.toUrl(fileUrl)`), not its symlink-resolved real path. Example: `docs/part.md` containing `![d](img/flow.png)`, injected into `README.md`, gives `docs/img/flow.png`.
2. **Remote source: absolute URL, against the URL as written.** A relative URL in a remote file becomes an absolute URL resolved against the directive's URL as the author wrote it, not the fetched `raw.githubusercontent.com` URL. `![d](img.png)` in `https://github.com/o/r/blob/main/docs/x.md` becomes `https://github.com/o/r/blob/main/docs/img.png`. No GitHub-specific logic is added to rebasing.
3. **`--output-dir` does not change the base.** Links are rebased relative to where the host file lives in the source tree, not where it is written. `--output-dir` doesn't rewrite the host file's own links, so injected links stay consistent with them.

## Options Considered

- **Resolve against the symlink-resolved real path.** Rejected. The author wrote links relative to the path they see in the tree. Following a symbolic link would produce a path through the link's target, which may even be outside the injection root.
- **Remote: rewrite images against the fetched raw URL.** Rejected for now. It would make images from GitHub sources display, but adds GitHub-specific rewriting and makes links and images resolve differently. Not verified: whether GitHub renders a `blob/` URL used as an image source. If it doesn't, remote images stay broken (see Consequences).
- **Remote: leave relative URLs unchanged.** Rejected: they can never work in the host document.
- **`--output-dir`: relative to the written file.** Rejected. Injected links would work from the output location while the host file's own links would not, which is harder to reason about than consistent behavior.

## Consequences

- An image in a remote GitHub source may not display if GitHub serves `blob/` URLs as HTML pages rather than image bytes. This hasn't been verified. If it's confirmed, a later ADR can add raw-URL mapping for images.
- With `--output-dir`, relative links in both the host file and the injected content work from the source tree, not from the output directory. This is unchanged from today's behavior for the host file's own links.
- A rebased local link may point outside the injection root (for example, `../../other/x.md`). Rebasing only rewrites text and reads nothing, so the injection-root boundary ([file-access-security ADR-0001](../file-access-security/0001-injection-root-boundary.md)) doesn't apply to it.

# ADR-0004: Format of a rebased path

**Status:** Proposed
**Date:** 2026-09-23
**Deciders:** Jason Dent

## Context

[ADR-0003](0003-rebase-base-resolution.md) decides what a relative URL is resolved against. The same target can then be written several ways (`docs/x.png`, `./docs/x.png`, `docs/./x.png`), and a few edge cases need a fixed answer: sibling injections where nothing needs to change, links back to the host file, and targets that don't exist.

## Decision

1. **Normalized POSIX relative path.** A rebased local URL is the shortest relative path from the host file's directory to the target, with `/` separators and no leading `./`. It uses `../` only as needed. The one exception is a link to the host file's own directory, which becomes `./` (point 4), because an empty URL would not be a link. `[a](./img/x.png)` in `docs/part.md`, injected into `README.md`, becomes `docs/img/x.png`.
2. **Query and fragment are kept verbatim.** `x.md?plain=1#usage` keeps `?plain=1#usage` after the rewritten path.
3. **Encoding is kept as written.** The rewrite changes only the path segments, and does not decode and re-encode percent-escapes (`my%20file.png` stays `my%20file.png` under its new directory). Whether the output uses the `<…>` destination form is left to `remark-stringify`, as for all injected content.
4. **Trailing slash is kept.** A directory link keeps its trailing `/`. If the target is the host file's own directory, the result is `./`.
5. **No rewrite when the directories match.** If the source file and host file are in the same directory, the URL is left textually untouched, including `./` and unnormalized spellings like `a/../x.png`. A sibling injection never changes any link text.
6. **No special case for links to the host file.** `[usage](../README.md#usage)` in `docs/part.md`, injected into `README.md`, becomes `README.md#usage`. It is not collapsed to `#usage`.
7. **No existence check.** Rebasing is a pure text rewrite and never touches the filesystem. A link that was broken in the source stays broken, pointing at the correctly rebased location. Because nothing is read, the injection root and `--deny-access` don't apply.
8. **URLs are treated as URLs, not OS paths.** A backslash is not a separator. On Windows, the path computation uses POSIX semantics on the URL path, like `relativePath` in [url_helper.ts](../../../src/util/url_helper.ts).

## Options Considered

- **Keep a leading `./` when the original had one.** Rejected in favor of one predictable form, whatever style the source used.
- **Always normalize, even for same-directory injections.** Rejected: it would change the output of sibling injections that were never broken.
- **Collapse self-links to `#fragment`.** Rejected. It's an extra rule with an awkward case (a self-link with no fragment), and `README.md#usage` already works on GitHub.
- **Warn when the target doesn't exist.** Rejected: it adds filesystem I/O, and it raises the question of whether checking a path outside the injection root is itself a probe. Link checking belongs to a separate tool.

## Consequences

- Placeholder substitution ([template-variables ADR-0006](../template-variables/0006-substitution-mechanics-and-timing.md)) only visits `text`, `inlineCode`, `code` and `html` nodes, never `url` fields. So a `{@ … @}` in a link destination is neither substituted nor treated specially: it is rebased like any other path characters.
- Point 3 relies on how `remark-parse` stores `url`. Checked against the installed version: `[a](my%20file.png)` gives `url: "my%20file.png"` (percent-escapes kept), while `<my file.png>` gives `"my file.png"` and `a&amp;b\)x.png` gives `"a&b)x.png"` (character references and backslash escapes decoded). Round-tripping through `remark-stringify` re-escapes as needed. The implementation should keep a test for this.

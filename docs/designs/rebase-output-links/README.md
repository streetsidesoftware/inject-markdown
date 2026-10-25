# Rebase output links

## Why

Link rebasing already rewrites a relative link in injected Markdown so it resolves from the host file instead of the source file (see the [relative links guide](../../guide/relative-links.md)). With `--output-dir`, links stay relative to where the host file sits in the source tree, not where it's written. That matches the host file's own links, but none of the relative links in the output tree work from the output location.

Two use cases need them to:

- **Output kept in the repository.** Generated docs are written to `out/` and read there, so `docs/img.png` must become `../docs/img.png`.
- **Output read away from the repository.** A README published to npm is shown without the repository around it, so a relative link only works as an absolute URL.

## Design

An opt-in CLI flag, `--rebase-output-links [base]`, rebases the relative links in every written file so they resolve from the file's output location, or from `base`. It covers the host file's own links and injected content alike. It requires `--output-dir`, so it only ever changes the generated copy.

Source `README.md` links to `docs/img.png`:

```sh
inject-markdown --output-dir out --rebase-output-links README.md
# out/README.md links to ../docs/img.png

inject-markdown --output-dir out --rebase-output-links https://github.com/o/r/blob/main/ README.md
# out/README.md links to https://github.com/o/r/blob/main/docs/img.png
```

A URL base stands for `--cwd`. A link becomes the base plus the target's path from `--cwd`.

### Which files and links

- **Every written file.** A file with no directives, otherwise copied byte for byte, is parsed and rebased too. The flag describes the output tree as a whole, and a copied file with broken links would defeat it.
- **The same links as source-to-host rebasing.** Inline links, images, and reference definitions with path-relative URLs. Raw HTML, code blocks, and absolute, `//`, `/`-rooted, and `#`-only URLs are left alone.

### Links between processed files

The _processed set_ is the files this run selects from the command line. Each of them has an output copy.

- **No value:** a link to a processed file points at its output copy. The output tree mirrors the source tree, so the link is unchanged: `b.md` in `a.md` stays `b.md` in `out/a.md`. Self-links such as `README.md#usage` stay too. Every other target points back into the source tree.
- **URL value:** every rebased link becomes absolute, including links to processed files. A file read away from the tree can't follow a relative link to a sibling copy either.
- **Root-relative links stay untouched in both forms.** On GitHub, `/` means the repository root, which need not be `--cwd`. Resolving it against the base could produce a plausible but broken URL.

The output of one file therefore depends on which other files the same run processes. `inject-markdown a.md` and `inject-markdown a.md b.md` can give different links in `out/a.md`.

### How it runs

- **It implies `--no-inject-only`.** The whole document is written from the parsed tree, with style still detected from the source file. Formatting remark can't reproduce may change in the output copy, including in files without directives.
- **Two stages, in order.** First, per directive, source to host, as today. Then, over the whole file, host to output. `#rebase-links=false` and `--no-rebase-links` only skip the first stage. Opted-out links are already relative to the host, so the second stage still applies to them.
- **A target outside `--cwd` under a URL base** has no path under the base. That link is rebased as in the no-value form, and a warning names it. The run doesn't fail.
- **`--clean`** output is rebased too, since it's still written to `--output-dir`. `--dry-run` writes nothing.

### Surface

- **The value must be an `http:` or `https:` URL.** Anything else, including a path or a `file:` URL, is an `OptionError`. That keeps a later directory form free to add without changing what an existing value means.
- **A trailing slash is added to the base.** URL resolution would otherwise drop the last segment (`main` in `.../blob/main`). A query or fragment in the base is an `OptionError`.
- **A missing `--output-dir` is an `OptionError`**, raised before any file is processed.
- **API:** `rebaseOutputLinks?: boolean | string` on `FileInjectorOptions`. `true` is the no-value form, and a string is the URL base.
- **One base for links and images.**
- **Run-wide only.** There's no `#` option. Where the output tree lives is a property of the run, like `--output-dir`. A file that needs different handling can go in a separate run.

It's opt-in, so it ships as a `feat:` minor release. The relative links guide documents it, and the README's `--output-dir` option gets a note.

## Open questions

- A directory base, meaning "the source tree is published at `<dir>`", once there's a concrete use case.
- A separate image base, such as `raw.githubusercontent.com`. It depends on whether GitHub displays a `blob/` URL as an image, which is unverified.
- Rewriting links in raw HTML (`<img src>`, `<a href>`, `srcset`), which link rebasing as a whole leaves alone today.

## Alternatives

- Allowing the flag without `--output-dir`: a URL base would permanently rewrite the source file's links into absolute URLs, and the next run couldn't rebase them.
- Treating any `.md` under `--cwd` as having an output copy: a link to an unprocessed file would break.
- Always pointing links to processed files into the source tree: a reader moving between output pages would leave the output tree.
- Patching only the changed links, to keep inject-only mode: exact formatting in the output copy, at the cost of a second code path. Only the generated copy is reformatted, never the source.
- An error for a target outside `--cwd` under a URL base: it blocks the whole run for one link that's no more broken than before.
- Resolving a target outside `--cwd` against the URL base anyway: only right when the base's parent maps to the parent of `--cwd`.

# Relative links

A relative link in an injected Markdown file is written relative to that file. `inject-markdown` rewrites it so it still resolves from the file it's injected into.

`docs/part.md`:

```markdown
![flow](img/flow.png) [guide](./guide.md#install)
```

Injected into `README.md`, this becomes:

```markdown
![flow](docs/img/flow.png) [guide](docs/guide.md#install)
```

## What is rewritten

- Inline links `[a](x.md)`, images `![a](x.png)` and reference definitions `[a]: x.md`.
- Only path-relative URLs: `x.md`, `./x.md`, `../x.md`.
- Links in Markdown table cells (`#markdown`, `#html-table`), relative to the table's source file.

The new path is the shortest relative path from the host file, without a leading `./`. A query string and `#fragment` are kept. When the two files are in the same directory, links are left exactly as written.

## What is left alone

- Absolute URLs (`https:`, `mailto:`, …), `//host/…`, root-relative `/…` and fragment-only `#…` URLs.
- Raw HTML such as `<img src="img/x.png">`.
- Markdown injected as a code block (`#code`, `#lang=…`, `@@inject-code:`), which shows the source as written.

Rewriting is text only. It never checks that the target exists, so a link that was broken in the source stays broken.

## Remote files

A relative link in a remote file becomes an absolute URL, resolved against the directive's URL as written. `![d](img.png)` in `https://github.com/o/r/blob/main/docs/x.md` becomes `https://github.com/o/r/blob/main/docs/img.png`.

## `--output-dir`

Links are rewritten relative to where the host file lives in the source tree, not where `--output-dir` writes it. That matches the host file's own links, which `--output-dir` doesn't change either.

## Turning it off

- For one directive: `<!--- @@inject: docs/part.md#rebase-links=false --->`.
- For a whole run: `--no-rebase-links`.

A directive's own `rebase-links` wins over the command line, so `#rebase-links` turns it back on for one directive in a `--no-rebase-links` run.

## Migrating

Before this feature, links in an injected file had to be written relative to the host file to work there. Such links now get rewritten and break. Either write them relative to the file they're in, which also makes them work when viewing that file on its own, or add `#rebase-links=false` to the directive.

The design is recorded in [docs/ADRs/relative-links](../ADRs/relative-links/README.md).

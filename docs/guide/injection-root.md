# Injection root

A local file reference in a directive must resolve inside the **injection root**: the directory set by `--cwd`, by default the current directory.

## Why

A Markdown file you process may come from someone else, such as a pull request. Without a boundary, a directive like `<!--- @@inject: ../../.ssh/id_rsa --->` could copy a file from outside the project (`.env`, SSH keys) into generated output.

## What is denied

- A reference that resolves outside the injection root, including through a symlink, fails with a fatal `Access denied` error.
- The error is worded and reported the same way whether or not the file exists, so it can't be used to probe the machine running the tool.
- Remote (`http(s)`) references are not affected.

## Allowing other directories

To allow a reference outside the root, pass `--allow-outside-root <dir>` for each extra directory. It can be repeated.

Like `--cwd`, each `<dir>` is resolved relative to the directory `inject-markdown` is run from, **not** relative to `--cwd`.

Example: in a monorepo, `packages/docs/README.md` injects a code sample from `packages/shared/src/example.ts`:

```sh
inject-markdown packages/docs/README.md --cwd packages/docs --allow-outside-root packages/shared
```

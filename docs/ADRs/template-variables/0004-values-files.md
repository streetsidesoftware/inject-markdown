# ADR-0004: Values files: format, paths, the injection root, and read errors

**Status:** Accepted

## Why

**Goal:** a release changes a version in one place, and every injected copy updates. That place is usually a file, such as `package.json` or a file CI writes.

**Problem:** copying many values into each directive goes stale. And a file path in directive text can reach any file the tool can read, unless it is bounded like other file references.

## Decision

1. **`values-file=[prefix:]path[,[prefix:]path...]` loads one or more files.** Each entry is its own declaration, in the order written. The key may also be repeated. How the prefix is read is in [Values-file prefixes](0005-values-file-prefixes.md).
2. **JSON only.** The whole file is parsed with `JSON.parse`.
3. **A directive's paths are relative to the Markdown document that holds the directive.** That's the same rule as the directive's own file reference.
4. **A directive's values files are subject to the injection root.** Each path passes the same injection-root check as any directive file reference, `--allow-outside-root` included. The file read is the path the check approved, so a symlink swapped in after the check can't redirect it.
5. **A bad directive entry is a directive error, and the other entries continue.** A file that can't be read or isn't valid JSON, or an entry whose prefix can't be derived, is reported at the directive. That entry contributes no values. The directive's other entries and its substitution still run, so names from the bad entry are also reported unresolved.
6. **A bad `--values-file` aborts the run.** On the command line, an unreadable or invalid file, or a prefix that can't be derived, stops the run with an error before the first document is injected, so nothing is written. The library API throws an `OptionError` in the same case. Their paths are covered in [Run-wide values on the command line](0006-run-wide-values-on-the-command-line.md).

## Consequences

- A directive can combine values from several files, such as `package.json` for `version` and a CI-generated `build-info.json`.
- `values-file=` can't be used to read files outside the injection root unless the person running the tool allows it.
- One broken values file in a directive doesn't hide the values from its other files. It still fails the run when errors stop it (`--stop-on-errors`).
- A mistake in run-wide input fails fast, before any output is written.
- YAML and other formats aren't supported.

## Context

- The feature request proposed `#values-file=../values.json` alongside inline values.
- `values-file=` first took a single path. It became a list because a directive commonly wants values from more than one file. Once it was a list, files had to be kept apart by default, which is what prefixes do.
- A values file is still a local file read triggered by text in a processed document. That's exactly what the injection-root boundary in [file-access-security](../file-access-security/README.md) closes, so there's no reason to exempt it.
- The two error behaviors follow who wrote the input. A directive error is a document problem, reported with the rest of that document's errors. A command-line value is the operator's input, and a wrong one makes the whole run's output suspect.
- There is no YAML parser in this project. `remark-frontmatter` delimits YAML front matter but doesn't parse it.

## Rejected approaches

- A single values file per directive: it can't combine `package.json` with a CI-generated file.
- Exempting `values-file=` from the injection root: it is the same exposure as any directive file read.
- Aborting the run on a bad directive values file: other directive errors are collected per document, not fatal to the run.
- Skipping a bad directive entry silently: the author would only see unresolved placeholders, not the cause.

# ADR-0005: Values-file prefixes: derived, explicit, root, and drive letters

**Status:** Accepted

## Why

**Goal:** each directive alone tells you which values it gets. With several values files, a reader has to see which file a name comes from.

**Problem:** files merged into one namespace collide silently on shared keys such as `name` and `version`. And a `prefix:path` grammar that splits at the first colon misreads every Windows path that starts with a drive letter.

## Decision

1. **An entry is `[prefix:]path`.** The same grammar applies to `values-file=` and `--values-file`.
2. **The colon is a separator only when the text before it is a valid prefix.** Otherwise the whole entry is a path. A prefix matches `^(?=.{2,})[A-Za-z0-9_][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_][A-Za-z0-9_-]*)*$`:
   - **Two characters or more.** A drive letter is always one character, so `C:\data\v.json`, `C:/data/v.json` and `c:package.json` are all paths.
   - **Dot-separated segments, none empty.** `..`, `a.` and `a..b` are not prefixes.
   - **No leading `-` or `.`** on any segment. `-foo`, `.env` and `pkg.-x` are paths. `build-info` is a prefix.
   - **No `/` or `\`.** A path-shaped head such as `\\?\C:\data\v.json` is a path.
   - **No `__proto__`, `constructor` or `prototype` segment.**

   Each segment is a placeholder-name segment ([Placeholder syntax and escaping](0001-placeholder-syntax-and-escaping.md)). A prefix only adds the two-character minimum.

3. **No prefix: derived from the file name.** An entry with no prefix (`values-file=package.json`) is placed under its basename, after removing a leading drive letter, the directories and the final extension. `package.json` gives `package`, `../shared/build-info.json` gives `build-info`, and `c:package.json` gives `package`.
4. **A derived prefix must be a single segment.** `build info.json` (a space), `v1.2.json` and `data.local.json` (a dot left after removing the extension) are errors that ask for an explicit prefix or `:path`. The name is never sanitized. How the error is reported depends on where the entry is written; see [Values files](0004-values-files.md).
5. **Explicit prefix:** `pkg:package.json` places the file under `pkg`. A dotted prefix nests: `pkg.build:data.json` places it under `{@ pkg.build.* @}`.
6. **Root merge:** `:path`, an empty prefix, places the file's top-level keys at the root, so `{@ version @}` reads its `version`.
7. **A root-merged file whose top level isn't an object contributes nothing.** An array or scalar at the top level has no names to offer. It is skipped without a message.
8. **A prefixed file whose top level is a scalar is a value.** `values-file=sha:sha.json`, where the file holds `"abc123"`, makes `{@ sha @}` resolve to `abc123`.
9. **Quoting:** a path may be wrapped in double quotes, after `prefix:` or `:`, or as the whole entry. In a `values-file=` list, a comma inside quotes is not a separator. A whole entry in quotes is never split at a colon; it is a path with a derived prefix.

## Consequences

- Adding a second file can never shadow the first file's keys. Each is namespaced unless the author writes `:path`.
- A single values file used with bare names needs `:path`: `values-file=:values.json` gives `{@ version @}`, while `values-file=values.json` gives `{@ values.version @}`.
- Absolute Windows paths work unquoted, on the command line and in directives.
- Single-character prefixes aren't available. An alias covers the case a short name was wanted for; see [Aliases](0010-aliases.md).
- PowerShell's multi-character drives (`Temp:`, `HKLM:`) parse as prefixes. Node can't resolve those paths anyway.
- A mistyped root-merged file, such as an array, yields only unresolved placeholders, with no message about the file. Whether it should warn is an open question in the [README](README.md).
- A file whose name has a colon after a two-character head, such as `ab:c.json`, needs a prefix in front: `:ab:c.json` or `pkg:ab:c.json`. Only the first colon separates.

## Context

- Auto-prefixing was first an opt-in: a bare `path` merged at the root and `:path` asked for a derived prefix. That made the unsafe form the easy one: a second file added later could silently shadow the first. The default flipped so every file is namespaced unless the author opts out.
- The colon first split at its first occurrence. `c:package.json` was read as prefix `c` and path `package.json`, which silently read a real file under a namespace nobody wrote. `C:\data\values.json` read the wrong absolute path. Windows is in the test matrix, and `--values-file` is the option most likely to get an absolute path. Quoting was the only escape, and from PowerShell that means `'"C:\data\values.json"'`. That led to the two-character rule.
- The prefix rule was first a flat class, `[A-Za-z0-9._-]{2,}`. It admitted `..`, `.env` and `-foo`, so it was replaced by the segment structure.
- Without removing the drive before deriving, `c:package.json` would derive `c:package` and fail. That would trade a silent wrong read for a confusing rejection of a valid path.
- Derived prefixes stay single-segment because a dot in a file name is not a deliberate namespace. Turning `v1.2.json` into a `v1` tree is the surprise rule 4 prevents.
- `__proto__`, `constructor` and `prototype` match the segment grammar, so they are excluded by name. Directive text is untrusted, and a prefix is written into a value tree.

## Rejected approaches

- Auto-prefixing as an opt-in: a later file could shadow an earlier one silently.
- A keyword such as `auto:path` for derivation: it reserves a prefix name, where "no colon" needs no keyword.
- Sanitizing an invalid basename: an implicit prefix is harder to predict than a clear error.
- Dots in derived prefixes: a version-named file would become a namespace tree.
- `=` as the separator: `=` is legal in file names too, and the root form `values-file==data.json` reads badly.
- Treating a one-character head as a drive only before `/` or `\`: a rule that has to be explained rather than stated.
- An error for a one-character head: `v:data.json` is a legal file name, and the parser shouldn't guess intent.
- Documenting the quoting workaround only: it leaves `c:package.json` silently reading the wrong file.

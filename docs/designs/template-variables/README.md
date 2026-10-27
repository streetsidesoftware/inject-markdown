# FINISHED: Template variables

## Why

Injected snippets repeat values that change, such as versions, package names, and URLs. Copies of those values go stale.

- Doc authors want one snippet injected into several documents with different values. Each directive alone should tell a reader which values it gets.
- Maintainers running releases or CI want to change a version in one place, and have every injected copy update on the next run.
- A placeholder that doesn't resolve has to be visible. It's never silently replaced.

The user guide is [docs/guide/template-variables.md](../../guide/template-variables.md).

## Design

A [placeholder](../../glossary.md#placeholder) such as `{@ package.version @}` in injected content is replaced with a value the directive supplies. Values come from the directive and the command line, never from the injected file.

`snippets/install.md` holds `npm install my-tool@{@ package.version @}`. `README.md` injects it:

```markdown
<!--- @@inject: snippets/install.md#values-file=package.json --->
```

`package.json` is loaded under the name `package`, so the injected text reads `npm install my-tool@1.2.3`.

Out of scope:

- A template engine: no conditionals, loops, or expressions.
- Values from the injected file.
- Turning objects or arrays into text, and indexing into arrays.
- Per-file values on the command line. A directive is the place for values that differ per document.

### Placeholder syntax

- The delimiters are `{@` and `@}`. Whitespace just inside them is optional, so `{@version@}` and `{@ version @}` are the same placeholder.
- A name is a dotted path of segments. A segment starts with a letter, digit, or underscore, followed by any of those or a hyphen. Each dot walks one level into a nested JSON object.
- Text that doesn't fit the grammar, such as `{@ -foo @}`, isn't a placeholder. It stays as written.
- There's no escape. A file that shows the syntax literally is injected without opting in.
- Every directive type uses the same syntax. Only how the result is spliced in differs.

### Opting a directive in

A directive is scanned for placeholders only if it carries a trigger: `values=`, `value=`, `values-file=`, `value-alias=`, or the bare flag `#vars`.

- An option that parses to nothing still opts in, such as an empty `#values=` or a malformed `value=`.
- `#vars` is for a directive that uses only run-wide values and environment variables. `#vars=false` doesn't opt in.
- A bare `#value` or `#value=` is not a trigger. It stays a heading reference. `URLSearchParams` can't tell the two apart.
- A directive without a trigger leaves `{@ ... @}` text alone, silently, backslashes included.

Scanning every directive would warn about content that only shows the syntax, including this tool's own docs. The cost is that a misspelled trigger, such as `#value-file=`, means no scanning and no warning.

### Inline values

- `values=name:val,name2:val2` sets several values. Each pair splits at its first `:`. Name and value are trimmed, and the value may be empty.
- A `values=` wrapped whole in double quotes is one pair: `values="range:1, 2, 3"`.
- A malformed `values=` pair (no `:`, or an empty name) is dropped silently.
- `value=name:val` sets one value. Everything after the first `:` is the value, commas and colons included, with no quoting.
- A malformed `value=` is a directive error. With one pair per occurrence, a missing colon is always a typo.
- Options are decoded by `URLSearchParams` first. A literal `&` is written `%26`, and `+` decodes to a space.

### Repeated keys

`values=`, `value=`, `values-file=`, and `value-alias=` gather every occurrence in document order. `#values-file=a.json&values-file=b.json` is the same as `#values-file=a.json,b.json`. Every other option keeps its last occurrence, silently.

If a repeated key kept only its last occurrence, a directive would silently lose a file that its text plainly declares.

### Values files

- `values-file=[prefix:]path[,[prefix:]path...]` loads JSON files. JSON is the only format, since the project has no YAML parser.
- Paths are relative to the document that holds the directive.
- Each path passes the same [injection root](../../guide/injection-root.md) check as a directive's file reference, `--allow-outside-root` included. The read uses the path the check approved, so a symbolic link swapped in after the check can't redirect it.
- An entry that can't be read, isn't valid JSON, or has no usable prefix is a directive error. The other entries still load, and names from the bad entry are reported unresolved.

### Prefixes

A _prefix_ is the name a values file's contents are placed under. Every file gets one unless the author opts out.

- **No prefix:** derived from the file name, without a drive letter, directories, or the final extension. `../shared/build-info.json` gives `build-info`.
- **A derived prefix must be one segment.** `v1.2.json` and `build info.json` are errors that ask for an explicit prefix. The name is never sanitized.
- **Explicit:** `pkg:package.json`. A dotted prefix nests, so `pkg.build:data.json` gives `{@ pkg.build.* @}`.
- **Root:** `:values.json` places the file's top-level keys at the root. A root file whose top level isn't an object contributes nothing.
- **A prefixed file holding a scalar** is that value. `sha:sha.json` holding `"abc123"` gives `{@ sha @}`.

The colon separates a prefix only when the text before it is a valid prefix. Otherwise the whole entry is a path. A valid prefix:

- is two characters or more, so a drive letter is never a prefix. `C:\data\v.json` and `c:package.json` are paths.
- is dotted segments that follow the placeholder name grammar, so `..`, `.env`, and `-foo` are paths.
- has no `/` or `\`.
- has no `__proto__`, `constructor`, or `prototype` segment, because directive text is untrusted and a prefix is written into an object.

Only the first colon separates, so `ab:c.json` has to be written `:ab:c.json` or `pkg:ab:c.json`. A path may be wrapped in double quotes. A comma inside quotes doesn't split the list, and a whole quoted entry is never split at a colon.

Namespacing is the default because root merging is the unsafe form: a second file added later would silently shadow the first one's keys. The two-character rule exists because Windows is in the test matrix, and `--values-file` is the option most likely to get an absolute path. Quoting alone is no fix, since from PowerShell it means typing `'"C:\data\values.json"'`.

### Run-wide values

- `--value <name>=<val>` sets one value. It splits at the first `=`. The name is trimmed and must not be empty.
- `--values-file <[prefix:]path>` loads a JSON file with the same grammar as `values-file=`. Paths are relative to `--cwd`. It isn't bounded by the injection root, because the person running the tool typed it.
- `--value-alias <new>=<target>` declares an alias (see [Aliases](#aliases)).
- All three are repeatable and keep their command-line order.
- Run-wide values are read once, are the same for every document, and reach only directives that opt in.
- A bad run-wide value or file stops the run before anything is written. It's the operator's input, and a wrong one makes the whole run suspect. A directive error, by contrast, is a document problem.

The API takes the same input as `valueDeclarations`, an ordered list of `{ kind: 'value', name, value }`, `{ kind: 'values-file', path, prefix }`, and `{ kind: 'alias', name, target }`. A `prefix` is `''` for the root or a dotted name. The drive-letter rule doesn't apply there, so a one-character prefix is accepted. `allowEnv` and `strictVars` match `--allow-env` and `--strict-vars`. Bad input throws an `OptionError`.

### Environment variables

Anyone who can open a pull request that touches a processed file can add a directive. Unrestricted access would let `{@ env.AWS_SECRET_ACCESS_KEY @}` copy a secret into generated output.

- `--allow-env <NAME>` allows one variable. It's repeatable.
- `{@ env.NAME @}` resolves to the variable when it's allowed and set. Otherwise it's unresolved.
- `env` is reserved. A name that is `env` or starts with `env.` is answered from the environment before any declaration is consulted. A values file's top-level `env` key is unreachable.
- The name has exactly two segments. `{@ env @}` and `{@ env.A.B @}` never resolve.
- No directive option allows a variable. An alias may target `env.NAME`, and the allow list still applies.

### Precedence: the newest declaration wins

A _declaration_ is one `values=` pair, one `value=`, one `values-file=` entry, one `value-alias=` pair, or the command-line equivalent. Declarations form one sequence, oldest to newest, and a newer one overrides an older one whatever option it came from.

- Command-line declarations are older than any directive's. `--value version=2.0` with `#values=version:1.0` gives `1.0`.
- The command line keeps its own order across `--value`, `--values-file`, and `--value-alias`.
- A directive reads left to right. In `#values-file=:package.json&values=version:0.0.0-dev&values-file=:release.json`, `release.json` wins for `version`.

A reader sees the order, so the order is the whole rule. Ranking by kind of source looked principled, but once options could repeat it contradicted the order on the page: the example above would give `0.0.0-dev`. A directive wins over the command line because a directive read alone should mean what it says. The cost is that CI can't override a value a directive hard-codes. To allow that, the directive leaves the value out.

### Per-leaf resolution

Every declaration that supplies values is a _layer_. Layers are never merged into a shared tree.

- A name resolves by walking the declarations newest first, and taking the first layer that holds that exact name as a scalar.
- A layer that lacks the name, or holds an object, array, or `null` there, doesn't stop the search.
- A scalar is a string, number, or boolean, substituted as `String(v)`. JSON `1.0` becomes `1`, so a version that must keep `1.0` is written as a string.
- `null` counts as absent.
- Lookup reads only a layer's own keys, so `{@ toString @}` never reaches an inherited member. Layers have no prototype, so a pair named `__proto__.x` is an ordinary own key.

So `--value package.engines.node=26.0` overrides one leaf, and `package.version` still comes from `package.json`. `--value a=1 --value a.b=2` keeps both names.

Any other rule treats cases differently that look the same in directive text. Two files under one prefix, replaced wholesale, lose keys only the older file has. A non-scalar can't stop the search, because `--value pkg.a=1` creates an object at `pkg` that would hide a scalar `pkg` from a file.

### Aliases

An _alias_ makes one placeholder name stand for another. The motivating directive loads two files and wants one name from the second to win: `#values-file=:./package.json&values-file=release:releases.json&value-alias=version:release.latest.version`.

- In a directive, `value-alias=new:target[,new2:target2]`, with the same list shape as `values=`. On the command line, `--value-alias new=target`. An empty name or a missing `=` there stops the run.
- Both sides are placeholder names.
- An alias is a declaration in the same sequence. For a given name, the newer of an alias and a value decides it.
- An alias holds no value. The target is resolved at lookup, against the whole sequence, so a values file declared after the alias can satisfy it.
- Chains are followed. A cycle leaves the placeholder unresolved.
- A target may be `env.NAME`, and the allow list still applies.
- If the target doesn't resolve, the name is unresolved. Resolution doesn't fall back to older values for it, so a broken target is reported rather than masked.

### Unresolved placeholders

A placeholder is unresolved when resolution finds no scalar for it.

- It stays in the output exactly as written.
- One message per unique name per directive, at the directive.
- The message is a warning by default. `--strict-vars` makes it a directive error, which then follows `--stop-on-errors` and `--write-on-error`. It doesn't abort the run by itself.
- Objects and arrays are never turned into text, in either mode.

The message reads `Unresolved placeholder "{@ name @}": <reason>`, so the author can tell a typo from a name that stops one segment short. The reason is one of:

- `no value source defines it`
- `resolves to an object, not a value` (or `an array`, or `null`)
- `aliased to "<target>": ` followed by one of the above
- `alias cycle through "<target>"`

### When substitution runs

Substitution runs after extraction, on the content that will be injected. Line ranges, `heading=`, and table row windows are applied first, so placeholders in discarded parts are neither replaced nor reported.

- **Markdown:** after the parse and heading extraction, substitution replaces text in place in `text`, `inlineCode`, `code`, and `html` nodes. The tree isn't turned back into Markdown and parsed again. Link and image URLs aren't visited, so a placeholder there is rebased like any other path text. Code-block wrapping and link rebasing come after.
- **Code:** the file's text, after the line range, is substituted as one string. It's then trimmed and wrapped in a code block.
- **Tables:** parsed cells are substituted after the header rows and row window are cut. For a JSON source, that includes the header keys and every string inside a nested cell, but not the keys inside it. Markdown cells (`#markdown`, `#html-table`) are parsed after substitution, so a value like `*draft*` renders in italics.

Substituting raw table text would let a value containing the delimiter add columns, or a `"` corrupt a JSON source. Working on nodes in place keeps the formatting that inject-only mode preserves. The cost is that a placeholder split across inline formatting, such as `{@ *ver*sion @}`, isn't recognized.

## Open questions

- Alias names and targets aren't checked against the name grammar yet ([#884](https://github.com/streetsidesoftware/inject-markdown/issues/884)).
- `--value` doesn't trim its value, unlike `value=` ([#885](https://github.com/streetsidesoftware/inject-markdown/issues/885)).
- The message for an unresolved `env.` name doesn't hint at `--allow-env` ([#886](https://github.com/streetsidesoftware/inject-markdown/issues/886)).
- Should a malformed `values=` pair be an error, as `value=` is? It would change an existing option.
- Should a root values file whose top level isn't an object warn? Today it contributes nothing, silently.
- YAML values files, once there's a need.
- An option that prints the resolved values. With layers, it would print them in order.

## Alternatives

- `value=name=val`, to match `--value`: hard to read next to the hash's own `=`.
- Warning on a repeated single-value key: it would fire on directives that work.
- Sanitizing a file name that isn't a valid prefix: an implicit prefix is harder to predict than a clear error.
- `=` as the prefix separator: it's legal in file names, and `values-file==data.json` reads badly.
- An error for conflicting definitions of a name: a new error class for a feature meant to stay simple.
- `null` as an empty string: a likely typo would become silently empty output.
- Plural `values-alias=`: each entry maps one name to one name.
- `--strict-vars` aborting the run: every other injection error is collected per document.
- A backslash escape, `\{@ name @}`: nobody used it, and in Markdown prose the parser drops the backslash before substitution sees it ([#887](https://github.com/streetsidesoftware/inject-markdown/issues/887)).

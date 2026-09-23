# Template variables

Injected content can contain `{@ name @}` placeholders. They are resolved against values the **directive** supplies (not the file being injected) and replaced at injection time.

For example, an injected snippet containing `npm install my-package@{@ version @}` becomes `npm install my-package@1.2.3`.

This is not a template engine: there are no conditionals or loops, only name-to-value substitution.

## Opting in

A directive only replaces placeholders if it has at least one of `values=`, `value=`, `values-file=`, `value-alias=` or the bare `vars` flag. Without one of these, `{@ ... @}` text passes through unchanged.

To show the syntax literally in an opted-in directive, write `\{@ name @}`.

## Inline values: `values=`

```markdown
<!--- @@inject-code: install.md#values=version:1.2.3 --->
```

List several values separated by commas: `values=name:my-package,version:1.2.3`.

## A single value: `value=`

`value=name:val` sets exactly one name. Everything after the first `:` is the value, so commas and colons need no quoting:

```markdown
<!--- @@inject-code: install.md#value=range:1, 2, 3&value=url:https://example.com --->
```

- A `value=` without a `:`, or with an empty name, is a directive error.
- The options are a URL fragment, so write `&` as `%26` and `+` as `%2B`; a bare `+` reads as a space.

## Values files: `values-file=`

Given `values.json`:

```json
{ "version": "1.2.3" }
```

By default, a file's values are placed under a prefix derived from its file name. Add a leading `:` to put them at the root instead:

```markdown
<!--- @@inject-code: install.md#values-file=values.json --->   uses {@ values.version @}
<!--- @@inject-code: install.md#values-file=:values.json --->  uses {@ version @}
```

You can also set the prefix yourself as `prefix:path`:

- A prefix may be dotted, and then it nests: `values-file=pkg.build:data.json` is read as `{@ pkg.build.* @}`.
- A prefix is at least two characters long, so a Windows drive letter is never taken for one. `C:\data\values.json` is a path, and its prefix is `values`.

## Aliases: `value-alias=`

An alias points one name at another instead of supplying a value. `value-alias=version:release.latest.version` makes `{@ version @}` mean whatever `{@ release.latest.version @}` means.

- An alias also opts the directive in.
- It follows the same [precedence](#precedence) as values: written after a values file, it redefines a name that file already has.
- If the target resolves to nothing, the placeholder is left unchanged with a warning naming both names.

## Repeating an option

`values=`, `value=`, `values-file=` and `value-alias=` can each appear more than once in one directive. The occurrences add up, as if they had been one comma-separated list. This is also how to give a value that contains a literal comma without quoting it.

Every other option keeps the last value given.

## Values from the command line

Run-wide values are available to every directive that opts in:

| Flag                            | Effect                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `--value <name=val>`            | Set one value. Repeatable.                                                                                   |
| `--values-file <[prefix:]path>` | Add a JSON file of values, with the same syntax as `values-file=`. Repeatable. Resolved relative to `--cwd`. |
| `--allow-env <NAME>`            | Expose the environment variable `NAME` as `{@ env.NAME @}`. Repeatable.                                      |
| `--value-alias <new=target>`    | Same as `value-alias=`, for every directive.                                                                 |
| `--strict-vars`                 | Make an unresolved placeholder an error instead of a warning.                                                |

Use the bare `vars` flag on a directive that should only use these command-line values.

## Precedence

- **The newest declaration wins.** `values=`, `value=`, `values-file=` and `value-alias=` count in the order they are written, whichever option they use. In `values=version:1.0&values-file=:release.json`, the file's `version` wins; swap them and `1.0` does.
- On the command line, `--value`, `--values-file` and `--value-alias` count in the order they are given.
- Everything a directive declares is newer than every command-line value, so a directive's own values win over the command line.
- `{@ env.NAME @}` always reads the environment; no values file or `value=` can override it.
- Values are overridden per name, not per file. Given a `values.json` of `{"version": "1.2.3", "name": "my-package"}`, `--value values.version=2.0.0` changes only that name; `{@ values.name @}` still comes from the file. The same holds when two values files are listed: the later one patches the earlier one instead of replacing it.

## Unresolved placeholders

A placeholder is unresolved when no source defines its name, or every source that has it holds an object, an array or `null` there. It is left unchanged, with a warning saying which. Pass `--strict-vars` to make it a directive error instead.

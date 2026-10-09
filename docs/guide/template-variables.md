# Template variables

Injected content can contain `{@ name @}` placeholders. They are resolved against values the **directive** supplies (not the file being injected) and replaced at injection time.

For example, an injected snippet containing `npm install my-package@{@ version @}` becomes `npm install my-package@1.2.3`.

This is not a template engine: there are no conditionals or loops, only name-to-value substitution.

## Opting in

A directive only replaces placeholders if it has at least one of `values=`, `value=`, `values-file=`, `value-alias=` or the bare `vars` flag. Without one of these, `{@ ... @}` text passes through unchanged.

- A mistyped option, such as `value-file=`, doesn't opt in. The directive isn't scanned, so there is no warning either.
- `vars=false` doesn't opt in.

To show the syntax literally in an opted-in directive, write `\{@ name @}`.

## Inline values: `values=`

```markdown
<!--- @@inject-code: install.md#values=version:1.2.3 --->
```

List several values separated by commas: `values=name:my-package,version:1.2.3`.

A pair with no `:`, or with an empty name, is ignored without a message. Use `value=` to have such a mistake reported.

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

List several files separated by commas: `values-file=package.json,:release.json`.

- Values files are JSON only.
- A path is relative to the document that holds the directive.
- The file must be inside the [injection root](injection-root.md), or in a directory allowed with `--allow-outside-root`.
- A number becomes text the way JavaScript prints it, so `1.0` becomes `1`. Write a version as a JSON string: `"1.0"`.

### Prefixes

A derived prefix is the file name without its extension: `package.json` gives `package`. It must be a valid name with no dots, so `v1.2.json` and `data.local.json` need an explicit prefix or `:path`.

You can also set the prefix yourself as `prefix:path`:

- A prefix may be dotted, and then it nests: `values-file=pkg.build:data.json` is read as `{@ pkg.build.* @}`.
- A prefix is at least two characters long, so a Windows drive letter is never taken for one. `C:\data\values.json` is a path, and its prefix is `values`.

If a file's top level is a single value rather than an object, its prefix holds that value. With `values-file=sha:sha.json` and a file containing `"abc123"`, `{@ sha @}` becomes `abc123`.

## Aliases: `value-alias=`

An alias points one name at another instead of supplying a value. `value-alias=version:release.latest.version` makes `{@ version @}` mean whatever `{@ release.latest.version @}` means.

- An alias also opts the directive in.
- It follows the same [precedence](#precedence) as values: written after a values file, it redefines a name that file already has.
- If the target resolves to nothing, the placeholder is left unchanged with a warning naming both names. An older value for the name is not used instead.
- If the target is itself an alias, that alias is followed too. An alias that leads back to itself is reported as a cycle.
- The target may be an `env.` name. It still needs `--allow-env`; see [Environment variables](#environment-variables).
- As with `values=`, a pair with no `:` is ignored without a message.

## Repeating an option

`values=`, `value=`, `values-file=` and `value-alias=` can each appear more than once in one directive. The occurrences add up, as if they had been one comma-separated list.

Each `values=` is still split at its commas. For a value that contains a comma, use `value=`. Or quote one whole `values=`, as in `values="range:1, 2, 3"`. A quoted `values=` holds exactly one pair.

Every other option keeps the last value given. The exception is a bare heading such as `#Install`, which keeps the first.

## Values from the command line

Run-wide values are available to every directive that opts in:

| Flag                            | Effect                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--value <name=val>`            | Set one value. Repeatable.                                                                                                       |
| `--values-file <[prefix:]path>` | Add a JSON file of values, with the same syntax as `values-file=`. Repeatable. Relative to `--cwd`, and not limited to the root. |
| `--allow-env <NAME>`            | Expose the environment variable `NAME` as `{@ env.NAME @}`. Repeatable.                                                          |
| `--value-alias <new=target>`    | Same as `value-alias=`, for every directive, but split at `=` instead of `:`. Repeatable.                                        |
| `--strict-vars`                 | Make an unresolved placeholder an error instead of a warning.                                                                    |

The bare `vars` flag opts a directive in without values of its own. The directive then uses the command-line values and the allowed environment variables.

## Environment variables

`{@ env.NAME @}` reads the environment variable `NAME`, but only if the run has `--allow-env NAME`. Otherwise it is unresolved.

- An `env.` name has exactly two parts. `{@ env @}` and `{@ env.A.B @}` never resolve.
- Nothing else can set an `env.` name. A values file with a top-level `env` key doesn't change `{@ env.NAME @}`.

## Precedence

- **The newest declaration wins.** `values=`, `value=`, `values-file=` and `value-alias=` count in the order they are written, whichever option they use. In `values=version:1.0&values-file=:release.json`, the file's `version` wins; swap them and `1.0` does.
- On the command line, `--value`, `--values-file` and `--value-alias` count in the order they are given.
- Everything a directive declares is newer than every command-line value, so a directive's own values win over the command line.
- Values are overridden per name, not per file. Given a `values.json` of `{"version": "1.2.3", "name": "my-package"}`, `--value values.version=2.0.0` changes only that name; `{@ values.name @}` still comes from the file. The same holds when two values files are listed: the later one patches the earlier one instead of replacing it.

## Errors in values

What happens depends on where the mistake is:

- **In a directive**, a `values-file=` entry that can't be read, isn't valid JSON, or has no valid prefix is a directive error. The directive's other entries still load.
- **On the command line**, a bad `--values-file`, `--value` or `--value-alias` stops the run before any file is written.

## Unresolved placeholders

A placeholder is unresolved when no source defines its name, or every source that has it holds an object, an array or `null` there. It is left unchanged, with a warning saying which. Each name is reported once per directive, however often it appears.

Pass `--strict-vars` to make it a directive error instead. Like any directive error, the document isn't written unless you pass `--write-on-error`, and the run stops unless you pass `--no-stop-on-errors`.

# Template variables

Injected content can contain `{@ name @}` placeholders. They are resolved against values the **directive** supplies (not the file being injected) and replaced at injection time.

For example, an injected snippet containing `npm install my-package@{@ version @}` becomes `npm install my-package@1.2.3`.

This is not a template engine: there are no conditionals or loops, only name-to-value substitution.

## Opting in

A directive only replaces placeholders if it has at least one of `values=`, `values-file=`, `value-alias=` or the bare `vars` flag. Without one of these, `{@ ... @}` text passes through unchanged.

To show the syntax literally in an opted-in directive, write `\{@ name @}`.

## Inline values: `values=`

```markdown
<!--- @@inject-code: install.md#values=version:1.2.3 --->
```

List several values separated by commas: `values=name:my-package,version:1.2.3`.

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
- It takes precedence over values the same directive supplies, so it can redefine a name that a values file already has.
- If the target resolves to nothing, the placeholder is left unchanged with a warning naming both names.

## Repeating an option

`values=`, `values-file=` and `value-alias=` can each appear more than once in one directive. The occurrences add up, as if they had been one comma-separated list. This is also how to give a value that contains a literal comma without quoting it.

Every other option keeps the last value given.

## Values from the command line

Run-wide values are available to every directive that opts in:

| Flag                            | Effect                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `--value <name=val>`            | Set one value. Repeatable; a later `--value` for the same name wins.                                         |
| `--values-file <[prefix:]path>` | Add a JSON file of values, with the same syntax as `values-file=`. Repeatable. Resolved relative to `--cwd`. |
| `--allow-env <NAME>`            | Expose the environment variable `NAME` as `{@ env.NAME @}`. Repeatable.                                      |
| `--value-alias <new=target>`    | Same as `value-alias=`, for every directive.                                                                 |
| `--strict-vars`                 | Make an unresolved placeholder an error instead of a warning.                                                |

Use the bare `vars` flag on a directive that should only use these command-line values.

## Precedence

- On a name collision, a directive's own `values=` and `values-file=` win over command-line values.
- Values are overridden per name, not per file. Given a `values.json` of `{"version": "1.2.3", "name": "my-package"}`, `--value values.version=2.0.0` changes only that name; `{@ values.name @}` still comes from the file. The same holds when two values files are listed: the later one patches the earlier one instead of replacing it.

## Unresolved placeholders

A placeholder is unresolved when no source defines its name, or every source that has it holds an object, an array or `null` there. It is left unchanged, with a warning saying which. Pass `--strict-vars` to make it a directive error instead.

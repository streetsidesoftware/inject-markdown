# Inject Markdown

Inject files into a Markdown file.

## Justification

Sometimes it is necessary to assemble content into a static markdown file like `README.md`.
Manually copying and pasting content leads to duplication making it difficult to keep things in sync.

## Usage

Use HTML comments to mark where content will be injected.

```markdown
<!--- @@inject: fixtures/sample-src.md --->
```

```sh
npx inject-markdown README.md
```

## `--help`

```sh
npx inject-markdown --help
```

**Result**

```
Usage: inject-markdown [options] <files...>

Inject file content into markdown files.

Arguments:
  files                 Files to scan for injected content.

Options:
  --no-must-find-files  No error if files are not found.
  --output-dir <dir>    Output Directory
  --cwd <dir>           Current Directory
  --clean               Remove the injected content.
  --verbose             Verbose output.
  --silent              Only output errors.
  --color               Force color.
  --no-color            Do not use color.
  -V, --version         output the version number
  -h, --help            display help for command
```

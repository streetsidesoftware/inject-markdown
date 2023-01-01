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

<!--- @@inject: content/help.txt --->

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

<!--- @@inject-end: content/help.txt --->

## Import Code

All non-markdown files will be imported as a code block.

```markdown
<!--- @@inject: content/code.ts --->
```

<!--- @@inject: content/code.ts --->

```ts
export function sayHello(name: string): string {
  return `Hello ${name}`;
}
```

<!--- @@inject-end: content/code.ts --->

## Import `json` as `jsonc`

```markdown
<!--- @@inject-code: content/sample.json#jsonc --->
```

<!--- @@inject-code: content/sample.json#jsonc --->

```jsonc
{
  "name": "Sample"
}
```

<!--- @@inject-end: content/sample.json#jsonc --->

## Import Markdown as Code

It is also possible to inject markdown:

<!--- @@inject-code: content/example.md --->

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

<!--- @@inject-end: content/example.md --->

## Import a section from a Markdown file

<!--- @@inject: content/chapters.md#Chapter 3: Directives --->

## Chapter 3: Directives

- `@@inject: <markdown_file.md>[#heading]` and `@@inject-start:  <markdown_file.md>[#heading]` -- injects the contents of a markdown file.
  - `<markdown_file.md>` -- the file to import
  - `heading` -- optional heading to extract.
- `@@inject: <non-markdown-file>[#lang]`, `@@inject-start:  <non-markdown-file>[#lang]`, and `@@inject-code: <file>[#lang]`
  - `<non-markdown-file>`, `<file>` -- the file to import
  - `lang` -- optional language to use for the code bock.

<!--- @@inject-end: content/chapters.md#Chapter 3: Directives --->

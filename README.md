# Markdown File Injector

[![unit tests](https://github.com/streetsidesoftware/inject-markdown/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/streetsidesoftware/inject-markdown/actions)
[![lint](https://github.com/streetsidesoftware/inject-markdown/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/streetsidesoftware/inject-markdown/actions)
[![codecov](https://codecov.io/gh/streetsidesoftware/inject-markdown/branch/main/graph/badge.svg?token=Dr4fi2Sy08)](https://codecov.io/gh/streetsidesoftware/inject-markdown)
[![Coverage Status](https://coveralls.io/repos/github/streetsidesoftware/inject-markdown/badge.svg?branch=main)](https://coveralls.io/github/streetsidesoftware/inject-markdown)

A Command line tool to inject files into Markdown files.

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

<!--- @@inject: content/README.md --->

# How to use Injections

## Import Code

All non-markdown files will be imported as a code block.

```markdown
<!--- @@inject: code.ts --->
```

```ts
export function sayHello(name: string): string {
  return `Hello ${name}`;
}
```

## Import `json` as `jsonc`

### Syntax

```markdown
<!--- @@inject-code: sample.json#lang=jsonc --->
```

### Example

````markdown
<!--- @@inject-code: sample.json#lang=jsonc --->

```jsonc
{
  "name": "Sample"
}
```

<!--- @@inject-end: sample.json#lang=jsonc --->
````

### Actual Result

```jsonc
{
  "name": "Sample"
}
```

## Import Markdown as Code

It is also possible to inject markdown:

```markdown
<!--- @@inject-code: example.md --->
```

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

## Import a section from a Markdown file

```markdown
<!--- @@inject: chapters.md#Chapter 3: Directives --->

or

<!--- @@inject: chapters.md#heading=Chapter 3: Directives --->
```

## Chapter 3: Directives

- `@@inject: <markdown_file.md>[#heading]` and `@@inject-start:  <markdown_file.md>[#heading]` -- injects the contents of a markdown file.
  - `<markdown_file.md>` -- the file to import
  - `heading` -- optional heading to extract.
- `@@inject: <non-markdown-file>[#lang]`, `@@inject-start:  <non-markdown-file>[#lang]`, and `@@inject-code: <file>[#lang]`
  - `<non-markdown-file>`, `<file>` -- the file to import
  - `lang` -- optional language to use for the code bock.

## Import from lines from GitHub

<img width="711" alt="image" src="https://user-images.githubusercontent.com/3740137/210188786-28704fe3-cc2f-447c-97fc-d27715dabbdc.png">

```
<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->
```

```typescript
async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
```

<!--- cspell:dictionaries typescript --->

<!--- @@inject-end: content/README.md --->

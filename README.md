# Markdown File Injector

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
  files                       Files to scan for injected content.

Options:
  --no-must-find-files        No error if files are not found.
  --output-dir <dir>          Output Directory
  --cwd <dir>                 Current Directory
  --allow-outside-root <dir>  Allow local @@inject references to resolve into
                              <dir>, outside the injection root (cwd).
                              Repeatable.
  --clean                     Remove the injected content.
  --no-inject-only            Update the whole file.
  --verbose                   Verbose output.
  --silent                    Only output errors.
  --no-stop-on-errors         Do not stop if an error occurs.
  --write-on-error            write the file even if an injection error occurs.
  --color                     Force color.
  --no-color                  Do not use color.
  --no-summary                Do not show the summary
  --dry-run                   Process the files, but do not write.
  -V, --version               output the version number
  -h, --help                  display help for command
```

<!--- @@inject-end: content/help.txt --->

<!--- @@inject: content/README.md --->

# How to use Injections

## Injection Root

A local (`file:`) directive reference must resolve inside the **injection root** — the directory set by `--cwd` (default: the current directory). A reference that resolves outside it, including via a symlink, is a read error; this protects against a directive in a processed Markdown file disclosing files outside the intended project tree (e.g. `.env`, SSH keys) into generated output. Remote (`http(s)`) references are unaffected.

For a legitimate reference outside the injection root — e.g. a monorepo doc at `packages/docs/README.md` injecting a code sample from a sibling `packages/shared/src/example.ts` — pass `--allow-outside-root <dir>` (repeatable) naming each additional directory that's allowed. Like `--cwd`, each `<dir>` is resolved relative to the directory `inject-markdown` is invoked from, not relative to `--cwd`:

```sh
inject-markdown packages/docs/README.md --cwd packages/docs --allow-outside-root packages/shared
```

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

## Import a CSV/TSV as a Table

`.csv` and `.tsv` files are injected as a Markdown table by default, using all of the columns.

### Syntax

```markdown
<!--- @@inject: sample.csv --->
```

### Example

```markdown
<!--- @@inject: sample.csv --->

| name         | role          |
| ------------ | ------------- |
| Ada Lovelace | Mathematician |
| Grace Hopper | Programmer    |

<!--- @@inject-end: sample.csv --->
```

### Actual Result

| name         | role          |
| ------------ | ------------- |
| Ada Lovelace | Mathematician |
| Grace Hopper | Programmer    |

To force a `.csv`/`.tsv` file to be injected as a code block instead, use `@@inject-code: sample.csv` or `@@inject: sample.csv#lang=csv`. To force any other file to be injected as a table, use `@@inject-table: <file>`.

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

> ## Chapter 3: Directives
>
> - `@@inject: <markdown_file.md>[#heading]` and `@@inject-start:  <markdown_file.md>[#heading]` -- injects the contents of a markdown file.
>   - `<markdown_file.md>` -- the file to import
>   - `heading` -- optional heading to extract.
>   - `code` -- optional embed as a `markdown` code block
>   - `quote` -- optional embed as a block quote.
> - `@@inject: <non-markdown-file>[#lang]`, `@@inject-start:  <non-markdown-file>[#lang]`, and `@@inject-code: <file>[#lang]`
>   - `<non-markdown-file>`, `<file>` -- the file to import
>   - `lang` -- optional language to use for the code bock.
>   - `quote` -- optional embed as a block quote.
> - `@@inject: <file.csv|file.tsv>` and `@@inject-table: <file>`
>   - `<file.csv>`, `<file.tsv>` -- a comma or tab separated file, injected as a Markdown table using all of its columns.
>   - `@@inject-table: <file>` -- force any file to be injected as a table, regardless of its extension.
>   - Use `@@inject-code: <file.csv>` or `#lang=csv` to inject the file as a code block instead of a table.

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

## Per Injections Options

The hash `#` portion of the file URL is used to set injection options. Each option is separated by a `&`.

| Option    | Code | Markdown | Description                                               |
| --------- | ---- | -------- | --------------------------------------------------------- |
| `heading` | ❌   | ✅       | Used to extract a section from a markdown file.           |
| `code`    | ❌   | ✅       | Convert the injected markdown into a Code Block.          |
| `lang`    | ✅   | ✅       | Used to set the language of the code block.               |
| `quote`   | ✅   | ✅       | Used to inject the file as a block quote.                 |
| `L1-L10`  | ✅   | ✅       | Used to inject only specified lines from the source file. |

### Example 1

Extract a few lines from a Markdown files and quote them.

```markdown
<!--- @@inject: example.md#L5-L7&quote --->
```

> - first
> - second
> - third

### Example 2

Extract some lines from a code block in the source.

```markdown
<!--- @@inject-code: code.md#L24-L26&lang=js --->
```

> ```js
> export function sayGoodbye(name) {
>   return `Goodbye ${name}`;
> }
> ```

<!--- @@inject-end: content/README.md --->

<!--- @@inject: static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: static/footer.md --->

# How to use Injections

## Injection Root

A local (`file:`) directive reference must resolve inside the **injection root** — the directory set by `--cwd` (default: the current directory). A reference that resolves outside it, including via a symlink, is denied with a fatal `Access denied` error; this protects against a directive in a processed Markdown file disclosing files outside the intended project tree (e.g. `.env`, SSH keys) into generated output. The denial is worded and reported identically whether or not the referenced file exists, so it can't be used to probe the machine running the tool. Remote (`http(s)`) references are unaffected.

For a legitimate reference outside the injection root — e.g. a monorepo doc at `packages/docs/README.md` injecting a code sample from a sibling `packages/shared/src/example.ts` — pass `--allow-outside-root <dir>` (repeatable) naming each additional directory that's allowed. Like `--cwd`, each `<dir>` is resolved relative to the directory `inject-markdown` is invoked from, not relative to `--cwd`:

```sh
inject-markdown packages/docs/README.md --cwd packages/docs --allow-outside-root packages/shared
```

## Import Code

All non-markdown files will be imported as a code block.

```markdown
<!--- @@inject: code.ts --->
```

<!--- @@inject: code.ts --->

```ts
export function sayHello(name: string): string {
  return `Hello ${name}`;
}
```

<!--- @@inject-end: code.ts --->

## Import `json` as `jsonc`

### Syntax

```markdown
<!--- @@inject-code: sample.json#lang=jsonc --->
```

### Example

<!--- @@inject-code: import-sample-json.md --->

````markdown
<!--- @@inject-code: sample.json#lang=jsonc --->

```jsonc
{
  "name": "Sample"
}
```

<!--- @@inject-end: sample.json#lang=jsonc --->
````

<!--- @@inject-end: import-sample-json.md --->

### Actual Result

<!--- @@inject: import-sample-json.md --->

```jsonc
{
  "name": "Sample"
}
```

<!--- @@inject-end: import-sample-json.md --->

## Import a CSV/TSV as a Table

`.csv` and `.tsv` files are injected as a Markdown table by default, using all of the columns.

### Syntax

```markdown
<!--- @@inject: sample.csv --->
```

### Example

<!--- @@inject-code: import-sample-csv.md --->

```markdown
<!--- @@inject: sample.csv --->

| name         | role          |
| ------------ | ------------- |
| Ada Lovelace | Mathematician |
| Grace Hopper | Programmer    |

<!--- @@inject-end: sample.csv --->
```

<!--- @@inject-end: import-sample-csv.md --->

### Actual Result

<!--- @@inject: import-sample-csv.md --->

| name         | role          |
| ------------ | ------------- |
| Ada Lovelace | Mathematician |
| Grace Hopper | Programmer    |

<!--- @@inject-end: import-sample-csv.md --->

To force a `.csv`/`.tsv` file to be injected as a code block instead, use `@@inject-code: sample.csv` or `@@inject: sample.csv#lang=csv`. To force any other file to be injected as a table, use `@@inject-table: <file>`.

### Markdown in Cells

By default, cell text is literal: any Markdown in it is escaped. Add `#markdown` to render inline Markdown (emphasis, code, links, images, strikethrough, and inline HTML) in every cell, header included.

- Block syntax such as `# Title` or `- item` stays literal text, because a table cell can't hold blocks.
- A `|` never needs escaping in the CSV; it's escaped in the output.
- A newline inside a quoted field becomes `<br />`.
- Raw HTML is passed through unchanged, so only use `#markdown` on CSV files you trust as much as the Markdown around them.

<!--- @@inject-code: import-sample-markdown-csv.md --->

```markdown
<!--- @@inject: sample-markdown.csv#markdown --->

| option       | description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `#markdown`  | Render **inline** Markdown, e.g. [links](https://github.com) and `a\|b` |
| - not a list | Block syntax stays literal<br />and a newline becomes a line break      |

<!--- @@inject-end: sample-markdown.csv#markdown --->
```

<!--- @@inject-end: import-sample-markdown-csv.md --->

Renders as:

<!--- @@inject: import-sample-markdown-csv.md --->

| option       | description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `#markdown`  | Render **inline** Markdown, e.g. [links](https://github.com) and `a\|b` |
| - not a list | Block syntax stays literal<br />and a newline becomes a line break      |

<!--- @@inject-end: import-sample-markdown-csv.md --->

### HTML Table with Markdown Cells

When cells need more than inline Markdown, use `#html-table`. It emits an HTML `<table>` instead of a pipe table, and each cell can hold full Markdown, including lists and paragraphs.

- A cell with Markdown is wrapped in blank lines so the renderer parses it; plain cells stay on one line.
- Newlines follow normal Markdown rules: a blank line starts a new paragraph.
- A `|` needs no escaping.
- `#html-table` implies Markdown cells, and wins if `#markdown` is also given.
- The output relies on CommonMark's HTML block rule: the blank line after an opening tag ends that HTML block, so the cell's content is parsed as ordinary Markdown before the closing tag, and the browser places the result inside the cell. GitHub and other CommonMark renderers handle this; renderers that don't follow the rule may show the Markdown as plain text.

<!--- @@inject-code: import-sample-html-table-csv.md --->

```markdown
<!--- @@inject: sample-html-table.csv#html-table --->

<table>
<thead>
<tr>
<th>option</th>
<th>description</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`#html-table`

</td>
<td>

Cells can hold **block** Markdown:

- lists
- several paragraphs

</td>
</tr>
<tr>
<td>plain</td>
<td>Plain cells stay on one line</td>
</tr>
</tbody>
</table>

<!--- @@inject-end: sample-html-table.csv#html-table --->
```

<!--- @@inject-end: import-sample-html-table-csv.md --->

Renders as:

<!--- @@inject: import-sample-html-table-csv.md --->

<table>
<thead>
<tr>
<th>option</th>
<th>description</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`#html-table`

</td>
<td>

Cells can hold **block** Markdown:

- lists
- several paragraphs

</td>
</tr>
<tr>
<td>plain</td>
<td>Plain cells stay on one line</td>
</tr>
</tbody>
</table>

<!--- @@inject-end: import-sample-html-table-csv.md --->

## Import Markdown as Code

It is also possible to inject markdown:

```markdown
<!--- @@inject-code: example.md --->
```

<!--- @@inject-code: example.md#code --->

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

<!--- @@inject-end: example.md#code --->

## Import a section from a Markdown file

```markdown
<!--- @@inject: chapters.md#Chapter 3: Directives --->

or

<!--- @@inject: chapters.md#heading=Chapter 3: Directives --->
```

<!--- @@inject: chapters.md#heading=Chapter 3: Directives&quote --->

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
>   - `markdown` -- optional; render inline Markdown in the table's cells instead of escaping it.
>   - `html-table` -- optional; emit an HTML table whose cells can hold full Markdown, including lists and paragraphs.

<!--- @@inject-end: chapters.md#heading=Chapter 3: Directives&quote --->

## Import from lines from GitHub

<img width="711" alt="image" src="https://user-images.githubusercontent.com/3740137/210188786-28704fe3-cc2f-447c-97fc-d27715dabbdc.png">

```
<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->
```

<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->

```typescript
async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
```

<!--- @@inject-end: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->

<!--- cspell:dictionaries typescript --->

## Template Variables

Injected content may contain `{@ name @}` placeholders, resolved against values the _directive_ supplies (not the file being injected) and substituted in at injection time — e.g. an injected snippet containing `npm install my-package@{@ version @}` becomes `npm install my-package@1.2.3` in the output. This isn't a full template engine: no conditionals or loops, just name-to-value substitution. Write `\{@ name @}` to show the syntax literally without triggering substitution.

A directive only scans its content for placeholders if it carries `values=`, `values-file=`, `value-alias=`, or the bare `vars` flag; without one of those, `{@ ... @}` text passes through untouched. An unresolved placeholder — nothing defines its name, or every source that has it holds an object, an array or `null` there — is left untouched with a warning saying which; pass `--strict-vars` to make that a directive error instead.

```markdown
<!--- @@inject-code: install.md#values=version:1.2.3 --->
```

<!--- @@inject-code: values-example.md#values=version:1.2.3 --->

```markdown
npm install my-package@1.2.3
```

<!--- @@inject-end: values-example.md#values=version:1.2.3 --->

Values can also come from a JSON file (`values.json`: `{"version": "1.2.3"}`), namespaced by default under a prefix derived from the file's name (`{@ values.version @}`), or merged directly at the root with a leading `:` (`{@ version @}`):

```markdown
<!--- @@inject-code: install.md#values-file=values.json --->
<!--- @@inject-code: install.md#values-file=:values.json --->
```

A `value-alias=` entry points one name at another instead of supplying a value: `value-alias=version:release.latest.version` makes `{@ version @}` mean whatever `{@ release.latest.version @}` means, following the sources as they change. It also opts the directive in, it outranks the values the same directive supplies (so it can redefine a name a values file already has), and an alias whose target points at nothing leaves the placeholder untouched with a warning naming both sides.

Any of `values=`, `values-file=` and `value-alias=` may be written more than once in the same directive; the occurrences accumulate, exactly as if their contents had been one comma-separated list. That is also how to give an entry that contains a literal comma without quoting it. Every other option keeps the last value written.

A values file's prefix is two characters or more, so a Windows drive letter is never mistaken for one — `--values-file C:\data\values.json` is a path, and its prefix is derived from the basename as `values`. A prefix may be dotted, in which case it nests: `values-file=pkg.build:data.json` is read as `{@ pkg.build.* @}`.

Run-wide values are available to any directive that opts in via `values=`, `values-file=`, `value-alias=`, or the bare `vars` flag — `--value <name=val>` (repeatable), `--values-file [prefix:]path` (repeatable JSON files, same `[prefix:]path` syntax as the directive-level option), and `--allow-env <NAME>` (repeatable, exposed as `{@ env.NAME @}`) — with a directive's own `values=`/`values-file=` taking precedence on a name collision.

Overriding is per name, not per file. Given a `values.json` of `{"version": "1.2.3", "name": "my-package"}`, a single `--value values.version=2.0.0` changes just that one name and `{@ values.name @}` still comes from the file — and the same holds when two values files are listed together, so a later one patches the earlier rather than replacing it. `--strict-vars` turns an unresolved placeholder into a directive error instead of a warning.

## Per Injections Options

The hash `#` portion of the file URL is used to set injection options. Each option is separated by a `&`.

| Option        | Code | Markdown | Description                                                             |
| ------------- | ---- | -------- | ----------------------------------------------------------------------- |
| `heading`     | ❌   | ✅       | Used to extract a section from a markdown file.                         |
| `code`        | ❌   | ✅       | Convert the injected markdown into a Code Block.                        |
| `lang`        | ✅   | ✅       | Used to set the language of the code block.                             |
| `quote`       | ✅   | ✅       | Used to inject the file as a block quote.                               |
| `L1-L10`      | ✅   | ✅       | Used to inject only specified lines from the source file.               |
| `values`      | ✅   | ✅       | Inline `{@ name @}` placeholder values: `name:val,name2:val2`.          |
| `values-file` | ✅   | ✅       | JSON file(s) of placeholder values: `[prefix:]path[,...]`.              |
| `vars`        | ✅   | ✅       | Opt into placeholder scanning using only CLI/environment value sources. |
| `value-alias` | ✅   | ✅       | Resolve one name as if it were another: `new:target,new2:target2`.      |

### Example 1

Extract a few lines from a Markdown files and quote them.

```markdown
<!--- @@inject: example.md#L5-L7&quote --->
```

<!--- @@inject: example.md#L5-L7&quote --->

> - first
> - second
> - third

<!--- @@inject-end: example.md#L5-L7&quote --->

### Example 2

Extract some lines from a code block in the source.

```markdown
<!--- @@inject-code: code.md#L24-L26&lang=js --->
```

<!--- @@inject-code: code.md#L24-L26&lang=js&quote --->

> ```js
> export function sayGoodbye(name) {
>   return `Goodbye ${name}`;
> }
> ```

<!--- @@inject-end: code.md#L24-L26&lang=js&quote --->

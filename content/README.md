## Quick start

1. Install it as a dev dependency (or skip this and use `npx`):

   ```sh
   npm install --save-dev inject-markdown
   ```

2. Add a directive where the content should go:

   ```markdown
   # My Project

   ## Example

   <!--- @@inject: code.ts --->
   ```

3. Run it on the Markdown file:

   ```sh
   npx inject-markdown README.md
   ```

The file now contains the content of `code.ts`, followed by an end marker:

<!--- @@inject-code: quickstart.md --->

````markdown
# My Project

## Example

<!--- @@inject: code.ts --->

```ts
export function sayHello(name: string): string {
  return `Hello ${name}`;
}
```

<!--- @@inject-end: code.ts --->
````

<!--- @@inject-end: quickstart.md --->

Run it again after `code.ts` changes, and the section between the two markers is refreshed.

To keep it in one place, add a script to `package.json`:

```json
{
  "scripts": {
    "build:docs": "inject-markdown README.md"
  }
}
```

## How it works

- **Directives are HTML comments**, so they don't show up when the Markdown is rendered.
- **The tool writes content after each directive** and closes it with an `@@inject-end` marker. On every run, everything between the directive and its end marker is replaced. Edit the source file, not the injected text.
- **How content is injected depends on the file type:** `.md` files are injected as Markdown, `.csv`/`.tsv` files as a table, and everything else as a fenced code block. The [directives](#directives) and [options](#injection-options) below override this.
- **Paths are relative to the Markdown file** that contains the directive. A reference can also be an `http(s)` URL; GitHub `blob` URLs are fetched as raw content.
- **Local references must stay inside the injection root** — the directory set by `--cwd`, by default the current directory. See [Injection root](../docs/guide/injection-root.md) for why, and for `--allow-outside-root`.
- **Only `.md` files are processed.** Pass files or glob patterns: `inject-markdown README.md "docs/**/*.md"`.
- **Unchanged files are not rewritten.**

Commonly used flags:

| Flag           | Effect                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| `--dry-run`    | Process the files and report, but don't write anything.                    |
| `--clean`      | Remove injected content. The directives stay, so the next run restores it. |
| `--output-dir` | Write the results to another directory instead of in place.                |
| `--verbose`    | Show more detail about each file.                                          |

See [CLI options](#cli-options) for the full list.

### Checking docs in CI

`--dry-run` exits successfully even when content is out of date. To fail a CI job when docs are stale, regenerate them and check for changes:

```sh
npx inject-markdown README.md
git diff --exit-code
```

## Directives

| Directive                | Effect                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `@@inject: <file>`       | Inject the file: Markdown as Markdown, CSV/TSV as a table, anything else as code.  |
| `@@inject-code: <file>`  | Always inject as a fenced code block, including Markdown and CSV/TSV files.        |
| `@@inject-table: <file>` | Always inject as a table, whatever the file extension.                             |
| `@@inject-start: <file>` | Same as `@@inject`.                                                                |
| `@@inject-end: <file>`   | Marks the end of injected content. The tool writes it; you don't normally need to. |

## Injection options

Add options after a `#` in the file reference, separated by `&`:

```markdown
<!--- @@inject: guide.md#heading=Install&quote --->
```

| Option                       | Applies to       | Effect                                                                                                                                             |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading=<text>`             | Markdown         | Inject only the section under this heading. The shorthand `#<text>` also works.                                                                    |
| `L<n>-L<m>`                  | All              | Inject only lines `n` to `m`, e.g. `#L5-L7`.                                                                                                       |
| `lang=<lang>`                | Code             | Set the code block's language. On a CSV/TSV file, this injects it as code instead of a table.                                                      |
| `code`                       | Markdown         | Inject Markdown as a code block. `code=<lang>` is the same as `lang=<lang>`.                                                                       |
| `quote`                      | All              | Inject as a block quote.                                                                                                                           |
| `markdown`                   | Tables           | Render inline Markdown in cells instead of escaping it.                                                                                            |
| `html-table`                 | Tables           | Emit an HTML table whose cells can hold full Markdown, including lists and paragraphs.                                                             |
| `rebase-links=false`         | Markdown, Tables | Keep relative links as written. By default they're rewritten to resolve from the host file. See [Relative links](../docs/guide/relative-links.md). |
| `values=<name:val,…>`        | All              | Values for `{@ name @}` placeholders. See [Template variables](#template-variables).                                                               |
| `values-file=<path>`         | All              | A JSON file of placeholder values.                                                                                                                 |
| `value-alias=<new:target,…>` | All              | Resolve one placeholder name as another.                                                                                                           |
| `vars`                       | All              | Resolve placeholders using only values set on the command line.                                                                                    |

## Recipes

Each example shows the directive and what the tool writes after it.

### Inject a Markdown file

<!--- @@inject-code: import-sample-md.md --->

```markdown
<!--- @@inject: example.md --->

# Example

This is an example bit of markdown.

- first
- second
- third

<!--- @@inject-end: example.md --->
```

<!--- @@inject-end: import-sample-md.md --->

### Keep relative links working

Relative links in an injected file are rewritten to resolve from the file they're injected into. Here `parts/links.md` links to `../example.md`:

<!--- @@inject-code: import-sample-links.md --->

```markdown
<!--- @@inject: parts/links.md --->

Read the [relative links guide](../docs/guide/relative-links.md) or the [example](example.md).

<!--- @@inject-end: parts/links.md --->
```

<!--- @@inject-end: import-sample-links.md --->

Use `#rebase-links=false` or `--no-rebase-links` to keep links as written. See [Relative links](../docs/guide/relative-links.md) for what is and isn't rewritten.

### Inject one section of a Markdown file

The section runs from the heading up to the next heading of the same or higher level.

<!--- @@inject-code: import-sample-heading.md --->

````markdown
<!--- @@inject: sections.md#heading=Install --->

## Install

```sh
npm install --save-dev inject-markdown
```

<!--- @@inject-end: sections.md#heading=Install --->
````

<!--- @@inject-end: import-sample-heading.md --->

### Inject a code file

Non-Markdown files become a code block. The language is taken from the file extension; use `lang=` to override it.

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

### Inject selected lines

<!--- @@inject-code: import-sample-lines.md --->

````markdown
<!--- @@inject: code.js#L5-L7 --->

```js
export function sayGoodbye(name) {
  return `Goodbye ${name}`;
}
```

<!--- @@inject-end: code.js#L5-L7 --->
````

<!--- @@inject-end: import-sample-lines.md --->

### Show Markdown as source

<!--- @@inject-code: import-sample-md-code.md --->

````markdown
<!--- @@inject-code: example.md --->

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

<!--- @@inject-end: example.md --->
````

<!--- @@inject-end: import-sample-md-code.md --->

### Inject as a block quote

<!--- @@inject-code: import-sample-quote.md --->

```markdown
<!--- @@inject: example.md#L5-L7&quote --->

> - first
> - second
> - third

<!--- @@inject-end: example.md#L5-L7&quote --->
```

<!--- @@inject-end: import-sample-quote.md --->

### Inject lines from GitHub

On GitHub, select the lines, choose **Copy permalink**, and use the URL as the file reference.

<!--- @@inject-code: import-sample-github.md --->

````markdown
<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->

```typescript
async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
```

<!--- @@inject-end: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->
````

<!--- @@inject-end: import-sample-github.md --->

<!--- cspell:dictionaries typescript --->

### Inject a CSV or TSV file as a table

All columns are included. Use `@@inject-code` or `#lang=csv` to inject the file as code instead.

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

#### Markdown in table cells

By default, Markdown in a cell is escaped and shown literally. Add `#markdown` to render inline Markdown (emphasis, code, links, images, strikethrough, inline HTML) in every cell, including the header.

- Block syntax such as `# Title` or `- item` stays literal, because a table cell can't hold blocks.
- A `|` in the CSV is escaped for you; a newline inside a quoted field becomes `<br />`.
- Raw HTML is passed through, so only use `#markdown` on CSV files you trust as much as the Markdown around them.

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

#### Block Markdown in table cells

When cells need lists or paragraphs, use `#html-table`. It writes an HTML `<table>` instead of a pipe table, and each cell can hold full Markdown. It implies `#markdown`.

This relies on a CommonMark rule: a blank line after an HTML tag ends the HTML block, so the cell's content is parsed as Markdown. GitHub and other CommonMark renderers support this; others may show the Markdown as plain text.

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

### Template variables

Injected content can contain `{@ name @}` placeholders. The directive supplies the values, so the same snippet can be reused with different values. Given a `values-example.md` containing `npm install my-package@{@ version @}`:

<!--- @@inject-code: import-sample-values.md --->

````markdown
<!--- @@inject-code: values-example.md#values=version:1.2.3 --->

```markdown
npm install my-package@1.2.3
```

<!--- @@inject-end: values-example.md#values=version:1.2.3 --->
````

<!--- @@inject-end: import-sample-values.md --->

Placeholders are only replaced when the directive has `values=`, `values-file=`, `value-alias=` or `vars`. Values can also come from JSON files and the command line (`--value`, `--values-file`, `--allow-env`). See [Template variables](../docs/guide/template-variables.md) for the full rules.

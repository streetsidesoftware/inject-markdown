# inject-markdown

Keep Markdown files in sync with the files they show. Mark a spot with an HTML comment, run `inject-markdown`, and the referenced file's content is written into place — and refreshed on every run.

```markdown
<!--- @@inject: src/example.ts --->
```

## Why

Docs such as `README.md` often repeat code samples, CLI help output or parts of other docs. Copied by hand, they drift out of date. `inject-markdown` copies them for you, so the source file stays the single source of truth.

<!--- @@inject: content/README.md --->

## Quick start

1. Install it as a dev dependency (or skip this and use `npx`):

   ```sh
   npm install --save-dev inject-markdown
   ```

1. Add a directive where the content should go:

   ```markdown
   # My Project

   ## Example

   <!--- @@inject: code.ts --->
   ```

1. Run it on the Markdown file:

   ```sh
   npx inject-markdown README.md
   ```

The file now contains the content of `code.ts`, followed by an end marker:

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
- **Local references must stay inside the injection root** — the directory set by `--cwd`, by default the current directory. See [Injection root](docs/guide/injection-root.md) for why, and for `--allow-outside-root`.
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

| Option                       | Applies to | Effect                                                                                        |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `heading=<text>`             | Markdown   | Inject only the section under this heading. The shorthand `#<text>` also works.               |
| `L<n>-L<m>`                  | All        | Inject only lines `n` to `m`, e.g. `#L5-L7`.                                                  |
| `lang=<lang>`                | Code       | Set the code block's language. On a CSV/TSV file, this injects it as code instead of a table. |
| `code`                       | Markdown   | Inject Markdown as a code block. `code=<lang>` is the same as `lang=<lang>`.                  |
| `quote`                      | All        | Inject as a block quote.                                                                      |
| `markdown`                   | Tables     | Render inline Markdown in cells instead of escaping it.                                       |
| `html-table`                 | Tables     | Emit an HTML table whose cells can hold full Markdown, including lists and paragraphs.        |
| `header-rows=<n>`            | Tables     | How many leading rows form the header. Default `1`; `0` means no header.                      |
| `start-row=<n>`              | Tables     | First data row to include, counting from 1 after the header rows.                             |
| `end-row=<n>`                | Tables     | Last data row to include.                                                                     |
| `num-rows=<n>`               | Tables     | Maximum number of data rows. Default `10000`.                                                 |
| `values=<name:val,…>`        | All        | Values for `{@ name @}` placeholders. See [Template variables](#template-variables).          |
| `value=<name:val>`           | All        | One placeholder value; commas and colons after the first `:` are part of the value.           |
| `values-file=<path>`         | All        | A JSON file of placeholder values.                                                            |
| `value-alias=<new:target,…>` | All        | Resolve one placeholder name as another.                                                      |
| `vars`                       | All        | Resolve placeholders using only values set on the command line.                               |

## Recipes

Each example shows the directive and what the tool writes after it.

### Inject a Markdown file

```markdown
<!--- @@inject: example.md --->

# Example

This is an example bit of markdown.

- first
- second
- third

<!--- @@inject-end: example.md --->
```

### Inject one section of a Markdown file

The section runs from the heading up to the next heading of the same or higher level.

````markdown
<!--- @@inject: sections.md#heading=Install --->

## Install

```sh
npm install --save-dev inject-markdown
```

<!--- @@inject-end: sections.md#heading=Install --->
````

### Inject a code file

Non-Markdown files become a code block. The language is taken from the file extension; use `lang=` to override it.

````markdown
<!--- @@inject-code: sample.json#lang=jsonc --->

```jsonc
{
  "name": "Sample"
}
```

<!--- @@inject-end: sample.json#lang=jsonc --->
````

### Inject selected lines

````markdown
<!--- @@inject: code.js#L5-L7 --->

```js
export function sayGoodbye(name) {
  return `Goodbye ${name}`;
}
```

<!--- @@inject-end: code.js#L5-L7 --->
````

### Show Markdown as source

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

### Inject as a block quote

```markdown
<!--- @@inject: example.md#L5-L7&quote --->

> - first
> - second
> - third

<!--- @@inject-end: example.md#L5-L7&quote --->
```

### Inject lines from GitHub

On GitHub, select the lines, choose **Copy permalink**, and use the URL as the file reference.

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

<!--- cspell:dictionaries typescript --->

### Inject a CSV or TSV file as a table

All columns are included. Use `@@inject-code` or `#lang=csv` to inject the file as code instead.

```markdown
<!--- @@inject: sample.csv --->

| name         | role          |
| ------------ | ------------- |
| Ada Lovelace | Mathematician |
| Grace Hopper | Programmer    |

<!--- @@inject-end: sample.csv --->
```

#### Header rows and selecting rows

`header-rows=<n>` makes the first `n` rows the header:

- With more than one, each column's header rows are joined with `<br />`, skipping blank cells. With `#html-table` they stay separate header rows.
- `header-rows=0` means every row is data. A pipe table then shows column numbers (`1`, `2`, …) as its header, and an `#html-table` has no header.
- `#header-rows` with no value means `header-rows=1`.

```markdown
<!--- @@inject: sample-header-rows.csv#header-rows=2 --->

| Date       | Name<br />First | Name<br />Last |
| ---------- | --------------- | -------------- |
| 1815-12-10 | Ada             | Lovelace       |
| 1906-12-09 | Grace           | Hopper         |

<!--- @@inject-end: sample-header-rows.csv#header-rows=2 --->
```

Renders as:

| Date       | Name<br />First | Name<br />Last |
| ---------- | --------------- | -------------- |
| 1815-12-10 | Ada             | Lovelace       |
| 1906-12-09 | Grace           | Hopper         |

`start-row`, `end-row` and `num-rows` choose which data rows are injected:

- Rows are numbered from 1, starting after the header rows.
- `num-rows` defaults to `10000`, so a larger file is cut off unless you raise it.
- A window past the end of the data gives a table with only its header.
- A value that isn't a whole number, or `start-row=0`, is an error.

```markdown
<!--- @@inject: sample-rows.csv#start-row=2&num-rows=2 --->

| n   | planet |
| --- | ------ |
| 2   | Venus  |
| 3   | Earth  |

<!--- @@inject-end: sample-rows.csv#start-row=2&num-rows=2 --->
```

#### Markdown in table cells

By default, Markdown in a cell is escaped and shown literally. Add `#markdown` to render inline Markdown (emphasis, code, links, images, strikethrough, inline HTML) in every cell, including the header.

- Block syntax such as `# Title` or `- item` stays literal, because a table cell can't hold blocks.
- A `|` in the CSV is escaped for you; a newline inside a quoted field becomes `<br />`.
- Raw HTML is passed through, so only use `#markdown` on CSV files you trust as much as the Markdown around them.

```markdown
<!--- @@inject: sample-markdown.csv#markdown --->

| option       | description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `#markdown`  | Render **inline** Markdown, e.g. [links](https://github.com) and `a\|b` |
| - not a list | Block syntax stays literal<br />and a newline becomes a line break      |

<!--- @@inject-end: sample-markdown.csv#markdown --->
```

Renders as:

| option       | description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `#markdown`  | Render **inline** Markdown, e.g. [links](https://github.com) and `a\|b` |
| - not a list | Block syntax stays literal<br />and a newline becomes a line break      |

#### Block Markdown in table cells

When cells need lists or paragraphs, use `#html-table`. It writes an HTML `<table>` instead of a pipe table, and each cell can hold full Markdown. It implies `#markdown`.

This relies on a CommonMark rule: a blank line after an HTML tag ends the HTML block, so the cell's content is parsed as Markdown. GitHub and other CommonMark renderers support this; others may show the Markdown as plain text.

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

Renders as:

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

### Template variables

Injected content can contain `{@ name @}` placeholders. The directive supplies the values, so the same snippet can be reused with different values. Given a `values-example.md` containing `npm install my-package@{@ version @}`:

````markdown
<!--- @@inject-code: values-example.md#values=version:1.2.3 --->

```markdown
npm install my-package@1.2.3
```

<!--- @@inject-end: values-example.md#values=version:1.2.3 --->
````

Placeholders are only replaced when the directive has `values=`, `value=`, `values-file=`, `value-alias=` or `vars`. Values can also come from JSON files and the command line (`--value`, `--values-file`, `--allow-env`). See [Template variables](docs/guide/template-variables.md) for the full rules.

<!--- @@inject-end: content/README.md --->

## Reference

- [Template variables](docs/guide/template-variables.md) — placeholders, values files, aliases, CLI values and how they combine.
- [Injection root](docs/guide/injection-root.md) — which local files a directive may read, and `--allow-outside-root`.

### CLI options

<details>
<summary><code>inject-markdown --help</code></summary>

<!--- @@inject: content/help.txt --->

```
Usage: inject-markdown [options] <files...>

Inject file content into markdown files.

Arguments:
  files                          Files to scan for injected content.

Options:
  --no-must-find-files           No error if files are not found.
  --output-dir <dir>             Output Directory
  --cwd <dir>                    Current Directory
  --allow-outside-root <dir>     Allow local @@inject references to resolve into
                                 <dir>, outside the injection root (cwd).
                                 Repeatable.
  --value <name=val>             Set a run-wide {@ name @} placeholder value.
                                 Repeatable; the last --value, --values-file or
                                 --value-alias defining a name wins.
  --values-file <[prefix:]path>  Add a run-wide JSON file of {@ name @}
                                 placeholder values, resolved relative to --cwd.
                                 Repeatable.
  --allow-env <name>             Allow a directive to reference the OS
                                 environment variable <name> via {@ env.name @}.
                                 Repeatable.
  --value-alias <new=target>     Resolve the {@ new @} placeholder as if it were
                                 {@ target @}. Repeatable; ordered with --value
                                 and --values-file.
  --strict-vars                  Treat an unresolved {@ name @} placeholder as a
                                 directive error.
  --clean                        Remove the injected content.
  --no-inject-only               Update the whole file.
  --verbose                      Verbose output.
  --silent                       Only output errors.
  --no-stop-on-errors            Do not stop if an error occurs.
  --write-on-error               write the file even if an injection error
                                 occurs.
  --color                        Force color.
  --no-color                     Do not use color.
  --no-summary                   Do not show the summary
  --dry-run                      Process the files, but do not write.
  -V, --version                  output the version number
  -h, --help                     display help for command
```

<!--- @@inject-end: content/help.txt --->

</details>

<!--- @@inject: static/footer.md --->

<br/>

---

<p align="center">
Brought to you by <a href="https://streetsidesoftware.com" title="Street Side Software">
<img width="16" alt="Street Side Software Logo" src="https://i.imgur.com/CyduuVY.png" /> Street Side Software
</a>
</p>

<!--- @@inject-end: static/footer.md --->

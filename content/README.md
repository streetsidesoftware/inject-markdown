# How to use Injections

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

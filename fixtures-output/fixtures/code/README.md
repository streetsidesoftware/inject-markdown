# This is a sample README

## Import Code

It contains some code:

<!--- @@inject: code.ts --->

```ts
export function sayHello(name: string): string {
    return `Hello ${name}`;
}
```

<!--- @@inject-end: code.ts --->

## Import `json` as `jsonc`

<!--- @@inject-code: sample.json#jsonc --->

```jsonc
{
    "name": "Sample"
}
```

<!--- @@inject-end: sample.json#jsonc --->

## Import Markdown as Code

It is also possible to inject markdown:

<!--- @@inject-code: example.md --->

```markdown
# Example

This is an example bit of markdown.

- first
- second
- third
```

<!--- @@inject-end: example.md --->

## Import a section from a Markdown file

<!--- @@inject: chapters.md#Chapter%203%3A%20Directives --->

## Chapter 3: Directives

-   `@@inject: <markdown_file.md>[#heading]` and `@@inject-start:  <markdown_file.md>[#heading]` -- injects the contents of a markdown file.
    -   `<markdown_file.md>` -- the file to import
    -   `heading` -- optional heading to extract.
-   `@@inject: <non-markdown-file>[#lang]`, `@@inject-start:  <non-markdown-file>[#lang]`, and `@@inject-code: <file>[#lang]`
    -   `<non-markdown-file>`, `<file>` -- the file to import
    -   `lang` -- optional language to use for the code bock.

<!--- @@inject-end: chapters.md#Chapter%203%3A%20Directives --->

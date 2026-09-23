## Chapter 1: Introduction

## Chapter 2: Simple Injections

## Chapter 3: Directives

- `@@inject: <markdown_file.md>[#heading]` and `@@inject-start:  <markdown_file.md>[#heading]` -- injects the contents of a markdown file.
  - `<markdown_file.md>` -- the file to import
  - `heading` -- optional heading to extract.
  - `code` -- optional embed as a `markdown` code block
  - `quote` -- optional embed as a block quote.
- `@@inject: <non-markdown-file>[#lang]`, `@@inject-start:  <non-markdown-file>[#lang]`, and `@@inject-code: <file>[#lang]`
  - `<non-markdown-file>`, `<file>` -- the file to import
  - `lang` -- optional language to use for the code bock.
  - `quote` -- optional embed as a block quote.
- `@@inject: <file.csv|file.tsv>` and `@@inject-table: <file>`
  - `<file.csv>`, `<file.tsv>` -- a comma or tab separated file, injected as a Markdown table using all of its columns.
  - `@@inject-table: <file>` -- force any file to be injected as a table, regardless of its extension.
  - `@@inject-table: <file.json>` -- a JSON array of objects, injected as a table with one column per key.
  - Use `@@inject-code: <file.csv>` or `#lang=csv` to inject the file as a code block instead of a table.
  - `header-rows` -- optional; how many leading rows form the header (default `1`; `0` for none).
  - `start-row`, `end-row`, `num-rows` -- optional; the data rows to include (default: the first 10,000).
  - `markdown` -- optional; render inline Markdown in the table's cells instead of escaping it.
  - `html-table` -- optional; emit an HTML table whose cells can hold full Markdown, including lists and paragraphs.

## Chapter 4

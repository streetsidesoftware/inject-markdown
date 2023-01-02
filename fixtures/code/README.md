# This is a sample README

## Import Code

It contains some code:

<!--- @@inject: code.ts --->

## Import `json` as `jsonc`

<!--- @@inject-code: sample.json#lang=jsonc --->

## Import Markdown as Code

It is also possible to inject markdown:

<!--- @@inject-code: example.md --->

## Import a section from a Markdown file

<!--- @@inject: chapters.md#Chapter 3: Directives --->

## Import from lines from

```
<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe5f894df712c71d05eb3450ead944e73/src/app.mts#L22-L25 --->
```

<!--- @@inject: https://raw.githubusercontent.com/streetsidesoftware/inject-markdown/d7de2f5f/src/app.mts#L22-L25 --->

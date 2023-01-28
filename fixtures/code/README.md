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

## Import from lines from GitHub

<img width="711" alt="image" src="https://user-images.githubusercontent.com/3740137/210188786-28704fe3-cc2f-447c-97fc-d27715dabbdc.png">

```
<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->
```

<!--- @@inject: https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19 --->

## GitHub Footnote

|        | version | Node | Support               | End-Of-Life |
| :----- | :------ | :--- | :-------------------- | :---------- |
| cspell | 6.x     | 14.x | In Active Development | TBD         |
| cspell | 5.x     | 12.x | Paid support only[^1] | 2022-10-01  |
| cspell | 4.x     | 10.x | Paid support only[^1] | 2022-05-01  |

[^1]: [Support - Street Side Software](https://streetsidesoftware.com/support/#maintenance-agreements)

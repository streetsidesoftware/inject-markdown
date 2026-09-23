# Tables

## Default CSV injection becomes a table

<!--- @@inject: sample.csv --->

| name  | age | city            |
| ----- | --- | --------------- |
| Alice | 30  | New York        |
| Bob   | 25  | Los Angeles, CA |

<!--- @@inject-end: sample.csv --->

## Default TSV injection becomes a table

<!--- @@inject: sample.tsv --->

| name   | color |
| ------ | ----- |
| Widget | Red   |
| Gadget | Blue  |

<!--- @@inject-end: sample.tsv --->

## Explicit `@@inject-table` directive

<!--- @@inject-table: sample.csv --->

| name  | age | city            |
| ----- | --- | --------------- |
| Alice | 30  | New York        |
| Bob   | 25  | Los Angeles, CA |

<!--- @@inject-end: sample.csv --->

## `@@inject-code` forces a code block

<!--- @@inject-code: sample.csv --->

```csv
name,age,city
Alice,30,New York
Bob,25,"Los Angeles, CA"
```

<!--- @@inject-end: sample.csv --->

## `#lang=csv` forces a code block

<!--- @@inject: sample.csv#lang=csv --->

```csv
name,age,city
Alice,30,New York
Bob,25,"Los Angeles, CA"
```

<!--- @@inject-end: sample.csv#lang=csv --->

## `#markdown` renders inline Markdown in cells

<!--- @@inject: markdown.csv#markdown&values=name:*draft* --->

| Option        | Description                                                                     | Default  |
| ------------- | ------------------------------------------------------------------------------- | -------- |
| **`columns`** | Pick columns, e.g. `a\|b` or a \| b                                             | _all_    |
| `#markdown`   | See [ADR-0008](../../docs/ADRs/table-improvements/0008-table-markdown-cells.md) | ~~off~~  |
| # Title       | - item stays literal                                                            | 1. first |
| <sup>1</sup>  | line one<br />line two                                                          | > note   |
| plain         | has _draft_                                                                     |          |

<!--- @@inject-end: markdown.csv#markdown&values=name:*draft* --->

## Without `#markdown` the same cells are literal

<!--- @@inject: markdown.csv --->

| Option              | Description                                                                       | Default     |
| ------------------- | --------------------------------------------------------------------------------- | ----------- |
| \*\*\`columns\`\*\* | Pick columns, e.g. \`a\|b\` or a \| b                                             | \_all\_     |
| \`#markdown\`       | See \[ADR-0008]\(../../docs/ADRs/table-improvements/0008-table-markdown-cells.md) | \~\~off\~\~ |
| # Title             | - item stays literal                                                              | 1. first    |
| \<sup>1\</sup>      | line one&#xA;line two                                                             | > note      |
| plain               | has {@ name @}                                                                    |             |

<!--- @@inject-end: markdown.csv --->

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

## `#html-table` emits an HTML table with Markdown cells

<!--- @@inject: html-table.csv#html-table --->

<table>
<thead>
<tr>
<th>Name</th>
<th>Notes</th>
<th>Count</th>
</tr>
</thead>
<tbody>
<tr>
<td>plain</td>
<td>a &lt; b &amp; c</td>
<td>42</td>
</tr>
<tr>
<td>

**bold**

</td>
<td>

**new**

- a
- b

</td>
<td>

`7`

</td>
</tr>
<tr>
<td>empty</td>
<td></td>
<td>

line one
line two

</td>
</tr>
<tr>
<td>pipe</td>
<td>a | b</td>
<td></td>
</tr>
</tbody>
</table>

<!--- @@inject-end: html-table.csv#html-table --->

## `#html-table` wins over `#markdown`

<!--- @@inject: markdown.csv#markdown&html-table --->

<table>
<thead>
<tr>
<th>Option</th>
<th>Description</th>
<th>Default</th>
</tr>
</thead>
<tbody>
<tr>
<td>

**`columns`**

</td>
<td>

Pick columns, e.g. `a|b` or a | b

</td>
<td>

_all_

</td>
</tr>
<tr>
<td>

`#markdown`

</td>
<td>

See [ADR-0008](../../docs/ADRs/table-improvements/0008-table-markdown-cells.md)

</td>
<td>

~~off~~

</td>
</tr>
<tr>
<td>

# Title

</td>
<td>

- item stays literal

</td>
<td>

1. first

</td>
</tr>
<tr>
<td>

<sup>1</sup>

</td>
<td>

line one
line two

</td>
<td>

> note

</td>
</tr>
<tr>
<td>plain</td>
<td>has {@ name @}</td>
<td></td>
</tr>
</tbody>
</table>

<!--- @@inject-end: markdown.csv#markdown&html-table --->

## Row window: `start-row=2&num-rows=2`

<!--- @@inject: rows.csv#start-row=2&num-rows=2 --->

| n | name  |
| - | ----- |
| 2 | two   |
| 3 | three |

<!--- @@inject-end: rows.csv#start-row=2&num-rows=2 --->

## Row window: `end-row=2`

<!--- @@inject: rows.csv#end-row=2 --->

| n | name |
| - | ---- |
| 1 | one  |
| 2 | two  |

<!--- @@inject-end: rows.csv#end-row=2 --->

## Row window past the end is a header-only table

<!--- @@inject: rows.csv#start-row=100 --->

| n | name |
| - | ---- |

<!--- @@inject-end: rows.csv#start-row=100 --->

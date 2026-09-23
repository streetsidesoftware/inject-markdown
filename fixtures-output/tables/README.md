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

## JSON table source

<!--- @@inject-table: people.json#values=version:1.0 --->

| name  | born | tags               | meta        | role            | active | note |
| ----- | ---- | ------------------ | ----------- | --------------- | ------ | ---- |
| Ada   | 1815 | \["math","poetry"] | {"v":"1.0"} |                 |        |      |
| Grace |      |                    |             | Admiral \| Navy | true   |      |
| Linus | 1969 |                    |             |                 |        |      |

<!--- @@inject-end: people.json#values=version:1.0 --->

## JSON table source with `#markdown`

<!--- @@inject-table: people.json#markdown&values=version:1.0 --->

| name  | born | tags                | meta          | role            | active | note |
| ----- | ---- | ------------------- | ------------- | --------------- | ------ | ---- |
| Ada   | 1815 | `["math","poetry"]` | `{"v":"1.0"}` |                 |        |      |
| Grace |      |                     |               | Admiral \| Navy | true   |      |
| Linus | 1969 |                     |               |                 |        |      |

<!--- @@inject-end: people.json#markdown&values=version:1.0 --->

## JSON table source with `#html-table`

<!--- @@inject-table: people.json#html-table&values=version:1.0 --->

<table>
<thead>
<tr>
<th>name</th>
<th>born</th>
<th>tags</th>
<th>meta</th>
<th>role</th>
<th>active</th>
<th>note</th>
</tr>
</thead>
<tbody>
<tr>
<td>Ada</td>
<td>1815</td>
<td>

```json
[
  "math",
  "poetry"
]
```

</td>
<td>

```json
{
  "v": "1.0"
}
```

</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>Grace</td>
<td></td>
<td></td>
<td></td>
<td>Admiral | Navy</td>
<td>true</td>
<td></td>
</tr>
<tr>
<td>Linus</td>
<td>1969</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

<!--- @@inject-end: people.json#html-table&values=version:1.0 --->

## JSON columns come from the row window

<!--- @@inject-table: people.json#start-row=2&end-row=2 --->

| name  | role            | active | note |
| ----- | --------------- | ------ | ---- |
| Grace | Admiral \| Navy | true   |      |

<!--- @@inject-end: people.json#start-row=2&end-row=2 --->

## JSON window past the end keeps a header of all keys

<!--- @@inject-table: people.json#start-row=100 --->

| name | born | tags | meta | role | active | note |
| ---- | ---- | ---- | ---- | ---- | ------ | ---- |

<!--- @@inject-end: people.json#start-row=100 --->

## Two header rows: `header-rows=2`

<!--- @@inject: grouped.csv#header-rows=2 --->

| Date       | Name<br />First | Name<br />Last | Value |
| ---------- | --------------- | -------------- | ----- |
| 2024-01-01 | Ada             | Lovelace       | 1     |
| 2024-01-02 | Grace           | Hopper         | 2     |

<!--- @@inject-end: grouped.csv#header-rows=2 --->

## Two header rows in an HTML table

<!--- @@inject: grouped.csv#header-rows=2&html-table --->

<table>
<thead>
<tr>
<th>Date</th>
<th>Name</th>
<th>Name</th>
<th>Value</th>
</tr>
<tr>
<th></th>
<th>First</th>
<th>Last</th>
<th></th>
</tr>
</thead>
<tbody>
<tr>
<td>2024-01-01</td>
<td>Ada</td>
<td>Lovelace</td>
<td>1</td>
</tr>
<tr>
<td>2024-01-02</td>
<td>Grace</td>
<td>Hopper</td>
<td>2</td>
</tr>
</tbody>
</table>

<!--- @@inject-end: grouped.csv#header-rows=2&html-table --->

## Header rows and the row window: `header-rows=2&start-row=2`

<!--- @@inject: grouped.csv#header-rows=2&start-row=2 --->

| Date       | Name<br />First | Name<br />Last | Value |
| ---------- | --------------- | -------------- | ----- |
| 2024-01-02 | Grace           | Hopper         | 2     |

<!--- @@inject-end: grouped.csv#header-rows=2&start-row=2 --->

## No header row: `header-rows=0`

<!--- @@inject: rows.csv#header-rows=0&num-rows=2 --->

| 1 | 2    |
| - | ---- |
| n | name |
| 1 | one  |

<!--- @@inject-end: rows.csv#header-rows=0&num-rows=2 --->

## No header row in an HTML table

<!--- @@inject: rows.csv#header-rows=0&num-rows=2&html-table --->

<table>
<tbody>
<tr>
<td>n</td>
<td>name</td>
</tr>
<tr>
<td>1</td>
<td>one</td>
</tr>
</tbody>
</table>

<!--- @@inject-end: rows.csv#header-rows=0&num-rows=2&html-table --->

## More header rows than the file has: all header, no data

<!--- @@inject: grouped.csv#header-rows=9 --->

| Date<br />2024-01-01<br />2024-01-02 | Name<br />First<br />Ada<br />Grace | Name<br />Last<br />Lovelace<br />Hopper | Value<br />1<br />2 |
| ------------------------------------ | ----------------------------------- | ---------------------------------------- | ------------------- |

<!--- @@inject-end: grouped.csv#header-rows=9 --->

## JSON with `header-rows=0` drops the key header

<!--- @@inject-table: people.json#header-rows=0&end-row=2 --->

| 1     | 2    | 3                  | 4                     | 5               | 6    | 7 |
| ----- | ---- | ------------------ | --------------------- | --------------- | ---- | - |
| Ada   | 1815 | \["math","poetry"] | {"v":"{@ version @}"} |                 |      |   |
| Grace |      |                    |                       | Admiral \| Navy | true |   |

<!--- @@inject-end: people.json#header-rows=0&end-row=2 --->

## No header row and a window past the end: numbered header, no data

<!--- @@inject: rows.csv#header-rows=0&start-row=100 --->

| 1 | 2 |
| - | - |

<!--- @@inject-end: rows.csv#header-rows=0&start-row=100 --->

## JSON with no key header and a window past the end: numbered columns, no data

<!--- @@inject-table: people.json#header-rows=0&start-row=100 --->

| 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| - | - | - | - | - | - | - |

<!--- @@inject-end: people.json#header-rows=0&start-row=100 --->

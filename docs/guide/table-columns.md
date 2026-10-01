# Table columns

These options shape the columns of a table injected from a CSV, TSV or JSON file. They go in the `#` fragment of the file reference, like the other table options:

```markdown
<!--- @@inject: prices.csv#columns=Qty,Item,Price:&header-format=title --->
```

## Choosing columns: `columns`

`columns` lists the columns to inject, in the order to show them. Columns that aren't listed are left out.

- Refer to a column by its number, counting from 1, or by its header text.
- A reference made only of digits is always a column number.
- Names are case-sensitive. Runs of spaces count as one space.
- With several header rows (`header-rows=2`), a column's name is its non-empty header cells joined by a space. A column headed `Name` over `First` is `Name First`.
- With `header-rows=0` there is no header text, so columns can only be referred to by number.
- A column listed twice appears twice. If two columns have the same name, the first one is used.
- To use spaces without encoding them, wrap the whole list in double quotes: `columns="Unit Price,Qty"`. A name can't contain a comma.

These are errors:

- a name that matches no column
- a number outside the table
- an empty entry, such as `columns=Name,,Qty`
- `columns` with no value

## Alignment

A colon in a `columns` entry sets that column's alignment, as in a Markdown table's delimiter row:

| Entry    | Alignment |
| -------- | --------- |
| `:Name`  | left      |
| `Name:`  | right     |
| `:Name:` | center    |

A column without a colon, including every column when `columns` isn't used, is right-aligned automatically when at least 90% of its non-empty data cells look like numbers. Header cells don't count. A number may have:

- a leading `+` or `-`
- a currency symbol: `$`, `€`, `£` or `¥`
- thousands and decimal separators in either style: `1,234.56` or `1.234,56`
- a trailing `%`

Codes such as `USD 5`, other currency symbols, and units such as `5kg` don't count as numbers. Only the rows that are injected are checked, so a column's alignment can change when its data changes.

In an `#html-table` table, alignment is written as an `align` attribute on each cell of the column.

## Header case: `header-format`

`header-format` changes the case of the header text when it is displayed:

| Value   | `unit price` becomes |
| ------- | -------------------- |
| `none`  | `unit price`         |
| `title` | `Unit Price`         |
| `upper` | `UNIT PRICE`         |
| `lower` | `unit price`         |

- `none` is the default.
- `title` capitalizes the first letter of each word and lowercases the rest. Only spaces separate words, so `UNIT_PRICE` becomes `Unit_price`.
- `columns` still matches the header as written in the source file, not the reformatted text.
- Any other value is an error.

## Header labels: `column-names`

`column-names` replaces header labels by position in the output, after `columns` has chosen and ordered the columns:

```markdown
<!--- @@inject: prices.csv#columns=Qty,Item&column-names="Count,Product" --->
```

- An empty entry keeps that column's header: `column-names=",,Unit cost"` relabels only the third column.
- Extra entries are ignored. Missing entries keep their headers.
- A label is used exactly as written. `header-format` doesn't change it.
- `columns` still matches the original header, not the label.
- With `header-rows=0`, a label replaces the column number shown as the header.
- In an `#html-table` table with several header rows, the label is in the last header row and the rows above it are blank for that column. With `header-rows=0`, labels add a header row.

Because the labels follow output order, reordering `columns` means reordering `column-names` to match.

## Markdown cells

With `#markdown` or `#html-table`, the options read a cell's visible text rather than its Markdown source:

- `columns=Price` matches a header written `**Price**`.
- `` `42` `` and `**$5.00**` count as numbers for alignment.
- `header-format` changes plain text only. Link URLs, inline code and raw HTML are left as written.
- A `column-names` label is parsed as Markdown, like the other cells.

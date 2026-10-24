# Tables

A `.csv` or `.tsv` file is injected as a table, and so is any file under `@@inject-table:`. The [README](../../README.md#inject-a-csv-or-tsv-file-as-a-table) shows the table options with examples. This guide holds the detailed rules.

## Header rows

- `header-rows=` takes a whole number. Anything else, such as `1.5` or `-1`, is a directive error.
- `#header-rows` or `header-rows=` with no value means `header-rows=1`.
- A file with fewer rows than `header-rows` is all header and has no data rows. That isn't an error.

## Choosing rows

- With a line range such as `#L2-L20`, those lines are cut from the file first. The header rows and the row window then count within them, so the first line of the range is the header.
- With both `end-row` and `num-rows`, the table stops at whichever comes first.
- Each of these gives a table with only its header:
  - `end-row=0`
  - `num-rows=0`
  - an `end-row` lower than `start-row`

## Turning an option off

`#markdown=false` and `#html-table=false` are accepted, and turn the option off. So `#markdown&html-table=false` gives a pipe table with Markdown cells.

## HTML table cells

With `#html-table`, each cell's text is parsed as a Markdown document of its own.

- A cell that is one line of plain text stays on its tag's line, as in `<td>42</td>`. Its `&`, `<` and `>` are written as `&amp;`, `&lt;` and `&gt;`.
- An empty cell is `<td></td>`.
- Any other cell is set off by blank lines, so the renderer parses it as Markdown.
- A newline in a cell means what it means in a `.md` file. A single newline is a soft wrap, which renders as a space. A blank line starts a new paragraph.
- A `|` needs no escaping.
- A link reference definition (`[a]: https://example.com`) or footnote definition (`[^1]: note`) stays in its cell as literal text. As a real definition, it would apply to the whole document. As a result, a reference to it in the same cell doesn't resolve either.

## JSON sources

- A file is read as JSON when its name ends in `.json`, in any case. `data.JSON` counts too.
- It must be strict JSON. Comments or trailing commas are an error.
- A `.jsonc` file isn't read as JSON.
- A key is a column even when its value is `null`.
- When the row window selects no rows, the header lists every key in the file.
- A number is shown the way JavaScript prints it, so `1.50` becomes `1.5` and `1e3` becomes `1000`. To keep the source form, store the value as a string: `"1.50"`.

## Placeholders

[Template variable](template-variables.md) placeholders are replaced in the parsed cells, not in the raw file. So a value that holds a comma or a quote can't add a column or break the file.

- In a CSV or TSV file, each field is replaced after the file is split into cells. With `#markdown` or `#html-table`, the Markdown is parsed after that, so a value like `*draft*` renders in italics.
- In a JSON file, replacement runs after the JSON is parsed. It covers the header keys and every string value, including strings inside a nested object or array. Keys inside a nested object stay as written.
- Rows outside the line range or row window aren't replaced, and their placeholders aren't reported.

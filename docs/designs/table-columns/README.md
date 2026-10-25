# WIP: Table columns

## Why

A [table injection](../../glossary.md#table-injection) shows every column of the source, in source order, with the source's header text and no alignment. Authors often want less, or different:

- only some columns, in a different order
- numbers and currency right-aligned
- friendlier header text than the source's machine-style `unit_price`

Today the only way is to edit the source file, or generate a second one just to feed the table.

`header-rows`, the row window options, `#markdown`, `#html-table`, and JSON sources are built and documented in the README. This design builds on them.

## Design

Four additions shape a table without touching its source:

- `columns` selects, reorders, and aligns columns.
- Auto-alignment right-aligns columns that look numeric.
- `header-format` changes the case of the header text.
- `column-names` replaces individual header labels.

```markdown
<!--- @@inject: data/prices.csv#columns=Name,Price:&header-format=title --->
```

This injects only the `Name` and `Price` columns, with `Price` right-aligned and both headers in title case.

### Encoding conventions

These hold for every table option, and match the built ones.

- **Lists are one comma-separated value**, not repeated keys: `columns=Name,Age:,Price:`.
- **The whole value may be wrapped in double quotes** to allow literal spaces: `columns="First Name,Age"`. The quotes wrap the list, not single entries. A name can't contain a literal comma.
- **Numbers start at 1**, for columns as for rows.
- **A bad reference fails the injection** as a directive error. That covers an out-of-range column number and an unmatched name. A silent skip would hide a typo.
- **Duplicates are allowed.** A column listed twice appears twice. A name that matches several headers picks the first.

### `columns`

`columns=<ref>[,<ref>...]` lists the output columns, in order. Columns not listed are left out.

- A reference is a column number or a header name.
- A name is matched against the column's _header match string_: its text from every header row, with blank cells dropped, joined with single spaces. Matching is whitespace-normalized and case-sensitive. So `columns="Name First,Name Last"` works against a two-row group header.
- With `header-rows=0` there's no header text, so a name is an error.
- An alignment marker mirrors the GFM delimiter row: `:Name` left, `Name:` right, `:Name:` center. No marker leaves the column to auto-alignment.

The cost is that a directive is coupled to its source's columns. A renamed or removed source column breaks it loudly, which catches drift on purpose.

### Auto-alignment

A column with no explicit marker is right-aligned when at least 90% of its non-empty data cells look numeric. Header cells and cells outside the row window don't count.

A cell looks numeric when it is:

- an optional `+` or `-` sign,
- then an optional `$`, `€`, `£`, or `¥`,
- then digits with thousands and decimal separators in either convention (`1,234.56` or `1.234,56`),
- then an optional `%`.

Auto-alignment only ever produces right alignment. An explicit marker in `columns` always wins.

The threshold tolerates a stray `N/A` or footnote. It also means a column can flip back to unaligned when enough non-numeric rows are added later. That should be documented so it isn't taken for a bug.

### `header-format`

`header-format=none|title|upper|lower` changes the case of header display text. The default is `none`.

- `title` capitalizes the first letter of each whitespace-separated word and lowercases the rest. `UNIT PRICE` becomes `Unit Price`. `UNIT_PRICE` becomes `Unit_price`.
- Each header row is formatted before the rows are joined with `<br />`.
- It's display only. `columns` still matches the source text, so changing the format never breaks a reference.
- With `header-rows=0`, the synthesized column numbers have no case, so it does nothing. That's not an error.

### `column-names`

`column-names=<label>[,<label>...]` replaces header labels by position in the output, after `columns` has selected and ordered them.

- An empty entry keeps the existing label: `column-names=",,Return Date,Value"` renames only the third and fourth columns.
- A label is shown exactly as written. `header-format` doesn't change it.
- It never affects which columns are selected, or what `columns` matches.
- A list shorter or longer than the output is fine. Missing entries keep their labels, and extras are ignored.
- It replaces whatever the header would show, including the synthesized numbers under `header-rows=0`.

The cost is that reordering `columns` means reordering `column-names` too. A renamed header also no longer matches the `columns` reference that selected it.

### Markdown cells

With `#markdown` or `#html-table`, a cell's source differs from what it shows: `**Price**` shows as `Price`. Each option above works on what the reader sees.

A cell's _plain text_ is, in document order:

- the text of its text nodes, including link text but not the URL
- the text of inline code and code blocks
- image alt text

Raw HTML contributes nothing, except that `<br>`, `<br />`, and a hard break each give one space. Adjacent blocks, such as paragraphs or list items, are separated by one space.

- **`columns` matches plain text.** `columns=Price` selects a header written `**Price**`, so turning `#markdown` on or off never breaks a reference.
- **Auto-alignment tests plain text.** `**$5.00**` and `` `42` `` count as numeric. In an `#html-table` the result is the `align` attribute.
- **`header-format` changes text nodes only.** URLs, alt text, inline code, and raw HTML keep their case. `**unit** [price](x.md)` with `upper` gives `**UNIT** [PRICE](x.md)`.
- **`column-names` labels are parsed as Markdown** in these tables, and still bypass `header-format`.

`title` casing has to track word boundaries across text nodes, since the start of a word can sit in an earlier node, as in `**un**it`.

## Open questions

- Renaming columns inside `columns=`, as [#899](https://github.com/streetsidesoftware/inject-markdown/issues/899) proposes for JSON tables with `columns=title:Command`. A trailing colon already means "right-align", so `title:` is ambiguous. It also overlaps `column-names`.
- Filtering rows with `where=`, also from [#899](https://github.com/streetsidesoftware/inject-markdown/issues/899). For example, `#where=contributes` keeps the JSON rows whose `contributes` key is `true`.
- Auto-alignment changes the output of every existing table with a numeric column. Should it be opt-in, so existing documents keep working?
- Does `columns` match a header before or after placeholder substitution? Template variables substitute header cells too.
- Column names that contain a literal comma have no escape.

## Alternatives

- `columns` matching the `<br />`-joined display text: authors would have to type HTML in a directive.
- Case-insensitive `columns` matching: less predictable, and typos fail fast elsewhere too.
- Any leading or trailing symbol as currency in auto-alignment: a units column like `5kg` would match.
- `_` and `-` as word boundaries in `header-format=title`: more rules for a case the author can fix in the source.
- `column-names` by position in the source: after `columns` reorders, source positions don't match anything visible.
- Passing `column-names` labels through `header-format`: `iPhone Sales` would become `Iphone Sales` under `title`.

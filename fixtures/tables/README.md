# Tables

## Default CSV injection becomes a table

<!--- @@inject: sample.csv --->

## Default TSV injection becomes a table

<!--- @@inject: sample.tsv --->

## Explicit `@@inject-table` directive

<!--- @@inject-table: sample.csv --->

## `@@inject-code` forces a code block

<!--- @@inject-code: sample.csv --->

## `#lang=csv` forces a code block

<!--- @@inject: sample.csv#lang=csv --->

## `#markdown` renders inline Markdown in cells

<!--- @@inject: markdown.csv#markdown&values=name:*draft* --->

## Without `#markdown` the same cells are literal

<!--- @@inject: markdown.csv --->

## `#html-table` emits an HTML table with Markdown cells

<!--- @@inject: html-table.csv#html-table --->

## `#html-table` wins over `#markdown`

<!--- @@inject: markdown.csv#markdown&html-table --->

## Row window: `start-row=2&num-rows=2`

<!--- @@inject: rows.csv#start-row=2&num-rows=2 --->

## Row window: `end-row=2`

<!--- @@inject: rows.csv#end-row=2 --->

## Row window past the end is a header-only table

<!--- @@inject: rows.csv#start-row=100 --->

## JSON table source

<!--- @@inject-table: people.json#values=version:1.0 --->

## JSON table source with `#markdown`

<!--- @@inject-table: people.json#markdown&values=version:1.0 --->

## JSON table source with `#html-table`

<!--- @@inject-table: people.json#html-table&values=version:1.0 --->

## JSON columns come from the row window

<!--- @@inject-table: people.json#start-row=2&end-row=2 --->

## JSON window past the end keeps a header of all keys

<!--- @@inject-table: people.json#start-row=100 --->

## Two header rows: `header-rows=2`

<!--- @@inject: grouped.csv#header-rows=2 --->

## Two header rows in an HTML table

<!--- @@inject: grouped.csv#header-rows=2&html-table --->

## Header rows and the row window: `header-rows=2&start-row=2`

<!--- @@inject: grouped.csv#header-rows=2&start-row=2 --->

## No header row: `header-rows=0`

<!--- @@inject: rows.csv#header-rows=0&num-rows=2 --->

## No header row in an HTML table

<!--- @@inject: rows.csv#header-rows=0&num-rows=2&html-table --->

## More header rows than the file has: all header, no data

<!--- @@inject: grouped.csv#header-rows=9 --->

## JSON with `header-rows=0` drops the key header

<!--- @@inject-table: people.json#header-rows=0&end-row=2 --->

## No header row and a window past the end: numbered header, no data

<!--- @@inject: rows.csv#header-rows=0&start-row=100 --->

## JSON with no key header and a window past the end: numbered columns, no data

<!--- @@inject-table: people.json#header-rows=0&start-row=100 --->

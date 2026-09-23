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

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

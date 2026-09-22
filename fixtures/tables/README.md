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

## `columns` selects, reorders, and aligns

<!--- @@inject: sample.csv#columns=city,:name:,age --->

## `header-rows=0` numbers the columns

<!--- @@inject: sample.csv#header-rows=0&columns=3,1 --->

## Two header rows, matched by their space-joined text

<!--- @@inject: grouped.csv#header-rows=2&columns="Name Last,Name First,Amount" --->

## Row window

<!--- @@inject: grouped.csv#header-rows=2&start-row=2&num-rows=2 --->

## `header-format` and `column-names`

<!--- @@inject: sample.csv#header-format=title&column-names=,Years --->

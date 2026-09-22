# Tables

## Default CSV injection becomes a table

<!--- @@inject: sample.csv --->

| name  | age | city            |
| ----- | --: | --------------- |
| Alice |  30 | New York        |
| Bob   |  25 | Los Angeles, CA |

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
| ----- | --: | --------------- |
| Alice |  30 | New York        |
| Bob   |  25 | Los Angeles, CA |

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

## `columns` selects, reorders, and aligns

<!--- @@inject: sample.csv#columns=city,:name:,age --->

| city            |  name | age |
| --------------- | :---: | --: |
| New York        | Alice |  30 |
| Los Angeles, CA |  Bob  |  25 |

<!--- @@inject-end: sample.csv#columns=city,:name:,age --->

## `header-rows=0` numbers the columns

<!--- @@inject: sample.csv#header-rows=0&columns=3,1 --->

| 3               | 1     |
| --------------- | ----- |
| city            | name  |
| New York        | Alice |
| Los Angeles, CA | Bob   |

<!--- @@inject-end: sample.csv#header-rows=0&columns=3,1 --->

## Two header rows, matched by their space-joined text

<!--- @@inject: grouped.csv#header-rows=2&columns="Name Last,Name First,Amount" --->

| Name<br />Last | Name<br />First | Amount    |
| -------------- | --------------- | --------- |
| Lovelace       | Ada             | $1,200.00 |
| Hopper         | Grace           | $950.50   |
| Turing         | Alan            | N/A       |
| Johnson        | Katherine       | $2,075.25 |

<!--- @@inject-end: grouped.csv#header-rows=2&columns="Name Last,Name First,Amount" --->

## Row window

<!--- @@inject: grouped.csv#header-rows=2&start-row=2&num-rows=2 --->

| Date       | Name<br />First | Name<br />Last | Amount  |
| ---------- | --------------- | -------------- | ------- |
| 2026-02-11 | Grace           | Hopper         | $950.50 |
| 2026-03-02 | Alan            | Turing         | N/A     |

<!--- @@inject-end: grouped.csv#header-rows=2&start-row=2&num-rows=2 --->

## `header-format` and `column-names`

<!--- @@inject: sample.csv#header-format=title&column-names=,Years --->

| Name  | Years | City            |
| ----- | ----: | --------------- |
| Alice |    30 | New York        |
| Bob   |    25 | Los Angeles, CA |

<!--- @@inject-end: sample.csv#header-format=title&column-names=,Years --->

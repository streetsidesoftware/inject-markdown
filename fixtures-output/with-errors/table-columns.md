# Invalid table column options

<!--- @@inject: ../tables/sample.csv#columns=zip --->

<!---
  Column "zip" not found in the table header.
--->

<!--- @@inject-end: ../tables/sample.csv#columns=zip --->

<!--- @@inject: ../tables/sample.csv#columns=9 --->

<!---
  Column 9 is out of range; the table has 3 column(s).
--->

<!--- @@inject-end: ../tables/sample.csv#columns=9 --->

<!--- @@inject: ../tables/sample.csv#header-rows=0&columns=name --->

<!---
  Column "name" must be referenced by number when header-rows=0.
--->

<!--- @@inject-end: ../tables/sample.csv#header-rows=0&columns=name --->

<!--- @@inject: ../tables/sample.csv#columns --->

<!---
  Invalid columns "": expected a list of column numbers or names.
--->

<!--- @@inject-end: ../tables/sample.csv#columns --->

<!--- @@inject: ../tables/sample.csv#header-format=camel --->

<!---
  Invalid header-format "camel": expected none, title, upper or lower.
--->

<!--- @@inject-end: ../tables/sample.csv#header-format=camel --->

# Invalid row window values

<!--- @@inject: ../tables/rows.csv#start-row=abc --->

<!---
  Invalid start-row "abc": expected a whole number.
--->

<!--- @@inject-end: ../tables/rows.csv#start-row=abc --->

<!--- @@inject: ../tables/rows.csv#start-row=0 --->

<!---
  Invalid start-row "0": row numbers start at 1.
--->

<!--- @@inject-end: ../tables/rows.csv#start-row=0 --->

<!--- @@inject: ../tables/rows.csv#num-rows=-1 --->

<!---
  Invalid num-rows "-1": expected a whole number.
--->

<!--- @@inject-end: ../tables/rows.csv#num-rows=-1 --->

<!--- @@inject: ../tables/rows.csv#header-rows=two --->

<!---
  Invalid header-rows "two": expected a whole number.
--->

<!--- @@inject-end: ../tables/rows.csv#header-rows=two --->

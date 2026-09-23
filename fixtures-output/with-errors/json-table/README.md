# Invalid JSON table sources

<!--- @@inject-table: invalid.json --->

<!---
  Invalid JSON: Unexpected token ']', "[{"a": 1},]
  " is not valid JSON
--->

<!--- @@inject-end: invalid.json --->

<!--- @@inject-table: object.json --->

<!---
  Expected a JSON array of objects, found an object.
--->

<!--- @@inject-end: object.json --->

<!--- @@inject-table: mixed.json --->

<!---
  Expected a JSON array of objects, but element 2 is a number.
--->

<!--- @@inject-end: mixed.json --->

<!--- @@inject-table: empty.json --->

<!---
  Expected a JSON array of objects, found an empty array.
--->

<!--- @@inject-end: empty.json --->

<!--- @@inject-table: ok.json#L1-L1 --->

<!---
  A line range can not be used on a JSON table; use start-row, end-row or num-rows.
--->

<!--- @@inject-end: ok.json#L1-L1 --->

<!--- @@inject-table: ok.json#header-rows=2 --->

<!---
  header-rows=2 can not be used on a JSON table; its keys form one header row.
--->

<!--- @@inject-end: ok.json#header-rows=2 --->

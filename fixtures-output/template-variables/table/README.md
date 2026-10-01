# Template variables — table injections

A value containing the delimiter must stay inside its own cell.

<!--- @@inject-table: data.csv#values="v:1,2" --->

| name  | version       |
| ----- | ------------- |
| pkg   | 1,2           |
| other | {@ missing @} |

<!--- @@inject-end: data.csv#values="v:1,2" --->

# Relative links

Rebased by default:

<!--- @@inject: docs/part.md --->

Opted out:

<!--- @@inject: docs/part.md#rebase-links=false --->

Opted in explicitly, which wins over `--no-rebase-links`:

<!--- @@inject: docs/part.md#rebase-links --->

Shown as code, never rebased:

<!--- @@inject: docs/part.md#code --->

As a quote:

<!--- @@inject: docs/part.md#quote --->

Table cells:

<!--- @@inject: docs/links.csv#markdown --->

<!--- @@inject: docs/links.csv#html-table --->

<!--- @@inject: docs/links.csv --->

JSON table cells:

<!--- @@inject-table: docs/links.json#markdown --->

Same directory, left as written:

<!--- @@inject: sibling.md --->

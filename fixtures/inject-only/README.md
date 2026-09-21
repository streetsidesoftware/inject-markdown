Inject Only
===========

This document is deliberately formatted in ways that a whole-document
re-stringify normalizes (setext heading, extra blank lines, an unusual
list marker), to check that `--inject-only` leaves everything outside the
injected span byte-for-byte untouched.


There are two blank lines above this paragraph.

* Item one
* Item two

<!--- @@inject: snippet.md --->

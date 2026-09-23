# Repeated hash keys (ADR-0011)

Repeating a key accumulates, exactly as if its contents had been written as one
comma-separated list. This is the same directive as the first section of
[README.md](README.md), spelled with the key repeated.

<!--- @@inject-code: redefine.txt#values-file=:./package.json&values-file=release:releases.json&value-alias=version:release.latest.version --->

```
name=demo version=2.5.0 date=2026-09-22
```

<!--- @@inject-end: redefine.txt#values-file=:./package.json&values-file=release:releases.json&value-alias=version:release.latest.version --->

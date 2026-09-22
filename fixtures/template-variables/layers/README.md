# Value layering (ADR-0008)

## Two values-file entries sharing a prefix union per leaf

<!--- @@inject-code: prefixed.txt#values-file=ns:a.json,ns:b.json --->

```
v=fromB a=A b=B deepA=yes deepB=yes
```

<!--- @@inject-end: prefixed.txt#values-file=ns:a.json,ns:b.json --->

## Two root-merged entries union per leaf

<!--- @@inject-code: rooted.txt#values-file=:a.json,:b.json --->

```
v=fromB a=A b=B deepA=yes
```

<!--- @@inject-end: rooted.txt#values-file=:a.json,:b.json --->

## Branch, null and array references stay unresolved

<!--- @@inject-code: unresolved.txt#values-file=branch:branch.json --->

```
branch={@ branch.engines @} nulled={@ branch.nulled @} list={@ branch.list @} typo={@ missingName @}
```

<!--- @@inject-end: unresolved.txt#values-file=branch:branch.json --->

# value-alias (ADR-0010)

## An alias redefines a name its own tier already supplies

<!--- @@inject-code: redefine.txt#values-file=:./package.json,release:releases.json&value-alias=version:release.latest.version --->

```
name=demo version=2.5.0 date=2026-09-22
```

<!--- @@inject-end: redefine.txt#values-file=:./package.json,release:releases.json&value-alias=version:release.latest.version --->

## Chains follow through

<!--- @@inject-code: chain.txt#values-file=release:releases.json&value-alias=a:b,b:release.latest.version --->

```
a=2.5.0
```

<!--- @@inject-end: chain.txt#values-file=release:releases.json&value-alias=a:b,b:release.latest.version --->

## A cycle is reported, not looped

<!--- @@inject-code: cycle.txt#value-alias=loop:round,round:loop --->

```
loop={@ loop @}
```

<!--- @@inject-end: cycle.txt#value-alias=loop:round,round:loop --->

## An alias to a name nothing defines names both sides

<!--- @@inject-code: missing.txt#value-alias=gone:no.such.name --->

```
missing={@ gone @}
```

<!--- @@inject-end: missing.txt#value-alias=gone:no.such.name --->

## A CLI alias may target the reserved `env.` namespace

<!--- @@inject-code: env-alias.txt#vars --->

```
token={@ token @}
```

<!--- @@inject-end: env-alias.txt#vars --->

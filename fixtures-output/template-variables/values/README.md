# Template variables — directive-level sources

## Inline values

<!--- @@inject-code: snippet-bare.txt#values=version:1.2.3 --->

```
Install: npm install pkg@1.2.3
```

<!--- @@inject-end: snippet-bare.txt#values=version:1.2.3 --->

## Values file, auto-derived prefix

<!--- @@inject-code: snippet-prefixed.txt#values-file=data.json --->

```
Install: npm install pkg@1.2.3
```

<!--- @@inject-end: snippet-prefixed.txt#values-file=data.json --->

## Values file, explicit prefix

<!--- @@inject-code: snippet-pkg-prefixed.txt#values-file=pkg:data.json --->

```
Install: npm install pkg@1.2.3
```

<!--- @@inject-end: snippet-pkg-prefixed.txt#values-file=pkg:data.json --->

## Values file, root merge

<!--- @@inject-code: snippet-bare.txt#values-file=:data.json --->

```
Install: npm install pkg@1.2.3
```

<!--- @@inject-end: snippet-bare.txt#values-file=:data.json --->

## Inline values take precedence over values-file

<!--- @@inject-code: snippet-bare.txt#values=version:9.9.9&values-file=:data.json --->

```
Install: npm install pkg@9.9.9
```

<!--- @@inject-end: snippet-bare.txt#values=version:9.9.9&values-file=:data.json --->

## Escaped placeholder stays literal

<!--- @@inject-code: escaped.txt#vars --->

```
Literal: {@ version @}
```

<!--- @@inject-end: escaped.txt#vars --->

## Not opted in: placeholder text passes through untouched

<!--- @@inject-code: snippet-bare.txt --->

```
Install: npm install pkg@{@ version @}
```

<!--- @@inject-end: snippet-bare.txt --->

## Opted in via bare vars, name undefined anywhere

<!--- @@inject-code: unresolved.txt#vars --->

```
Value: {@ missing @}
```

<!--- @@inject-end: unresolved.txt#vars --->

## Non-scalar value is unresolved

<!--- @@inject-code: snippet-bare.txt#values-file=:nested.json --->

```
Install: npm install pkg@{@ version @}
```

<!--- @@inject-end: snippet-bare.txt#values-file=:nested.json --->

## Markdown injection substitutes inside prose, inline code, and fenced code

<!--- @@inject: markdown-snippet.md#values=version:2.0.0 --->

This release is version 2.0.0.

`npm install pkg@2.0.0`

```
console.log('2.0.0');
```

<!--- @@inject-end: markdown-snippet.md#values=version:2.0.0 --->

# Template variables — `value=`

## Commas and colons after the first colon are literal

<!--- @@inject-code: range.txt#value=range:1, 2, 3&value=url:https://example.com/a:b --->

```
Range: 1, 2, 3
URL: https://example.com/a:b
```

<!--- @@inject-end: range.txt#value=range:1, 2, 3&value=url:https://example.com/a:b --->

## A `value=` without a colon is a directive error

<!--- @@inject-code: range.txt#value=range --->

```
Range: {@ range @}
URL: {@ url @}
```

<!--- @@inject-end: range.txt#value=range --->

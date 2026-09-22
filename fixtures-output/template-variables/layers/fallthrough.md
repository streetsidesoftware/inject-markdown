# Non-scalar fall-through

A directive `values=` dotted name makes an object at `x`; the lower-precedence CLI
`--value x=...` scalar must still resolve `{@ x @}`.

<!--- @@inject-code: fallthrough.txt#values=x.y:fromDirective --->

```
x={@ x @} xy=fromDirective
```

<!--- @@inject-end: fallthrough.txt#values=x.y:fromDirective --->

# Block Quotes

It is possible to Block Quote injected content.

```markdown
<!--- @@inject: include.md#heading=Section 2&quote --->
```

<!--- @@inject: include.md#Section 2&quote --->

> ## Section 2
>
> This is section 2 and its content.
>
> - One
> - Two
> - Three
>
> ```json
> { "debug": true }
> ```

<!--- @@inject-end: include.md#Section 2&quote --->

<!--- @@inject: include.md#Section 2&quote&code --->

> ````markdown
> ## Section 2
>
> This is section 2 and its content.
>
> * One
> * Two
> * Three
>
> ```json
> { "debug": true }
> ```
> ````

<!--- @@inject-end: include.md#Section 2&quote&code --->

<!--- @@inject: include.md#L13-L18&quote --->

> This is section 2 and its content.
>
> - One
> - Two
> - Three

<!--- @@inject-end: include.md#L13-L18&quote --->

<!--- @@inject: include.md#heading=Nested&L22-L31&quote --->

> ### Nested
>
> This is nested under Section 3

<!--- @@inject-end: include.md#heading=Nested&L22-L31&quote --->

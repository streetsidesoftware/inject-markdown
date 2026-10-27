# Markdown builders

The Markdown builders moved to toolbox as [`@streetsidesoftware/markdown-toolkit`](https://github.com/streetsidesoftware/toolbox/tree/main/packages/markdown-toolkit). Their design is [there too](https://github.com/streetsidesoftware/toolbox/blob/main/packages/markdown-toolkit/docs/design.md).

inject-markdown re-exports the package as `inject-markdown/markdown`. It also uses the package's placeholder substitution and style detection when it injects.

## Open questions

These concern injection, so they stay here:

- A values file's top-level dotted keys aren't read as dotted names: `getPath` walks one segment at a time. Should values files follow the values-object rule?
- Markdown-valued placeholders at injection time. The placeholder opts in. The syntax is open.

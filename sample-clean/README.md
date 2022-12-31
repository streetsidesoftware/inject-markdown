# Sample README.md

This is an example readme.

We want to inject some content from some other files.

To do this, we add comments to indicate where to inject the content:

```markdown
<!--- @@inject: first-sample.md --->
```

⬇︎⬇︎⬇︎⬇︎ Below is the content of `first-sample.md` ⬇︎⬇︎⬇︎⬇︎

<!--- @@inject: first-sample.md --->

⬆︎⬆︎⬆︎⬆︎ Above is the content of `first-sample.md` ⬆︎⬆︎⬆︎⬆︎

To inject the content, run:

```sh
npx inject-markdown README.md
```

To remove the injected content, use `--clean`:

```sh
npx inject-markdown --clean README.md
```

To write the result to another directory, use `--output-dir`:

```sh
npx inject-markdown README.md --output-dir hydrated
```

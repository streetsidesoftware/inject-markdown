# Design principles

Rules that guide how inject-markdown behaves. Weigh every behavior change against them. When a [design](feature-design.md) sets a rule that holds beyond its feature, add it here.

## Existing documents keep working

People commit generated docs and check them in CI. A new release shouldn't break a document that works today.

- A new option defaults to the current behavior.
- A change that makes a working directive fail, or makes correct output wrong, is breaking: `feat!:` or `fix!:`.
- A change that fixes broken output can ship as `feat:` or `fix:`. The release note names the change and how to opt out.

## Local reads stay inside the injection root

A directive is text in a Markdown file, so anyone who can open a pull request can add one. The tool often runs in CI, with real credentials on the machine.

- A local directive reference that resolves outside the injection root is refused, unless the user allows that directory.
- File discovery is bounded by the injection root too, so the tool never rewrites a file outside it. Symbolic links still break this rule today ([#865](https://github.com/streetsidesoftware/inject-markdown/issues/865)).

The [injection root guide](guide/injection-root.md) describes the rules.

## An injection pass keeps a file's formatting

Injecting into a file changes the injected sections and nothing else. The Markdown style of the rest of the file, such as bullet characters and fence characters, is detected from the file and kept.

## A denial says as much as it safely can

When the tool refuses something, the message names what was refused and the option that would allow it.

The exception is a denial whose decision depended on something the untrusted party must not learn. Then the reason goes to the console, and the document gets a generic failure.

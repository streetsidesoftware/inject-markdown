# WIP: Markdown builders

## Why

Scripts in cspell, cspell-dicts, vscode-cspell-dict-extensions, cspell-parsers, and toolbox generate Markdown for inject-markdown to inject. Each one writes links, lists, inline code, code blocks, and tables by hand.

Most of that code doesn't escape correctly:

- link text containing `]`
- a `|` in a table cell
- a backtick in inline code

So a value containing one of those characters silently breaks the generated docs, and every repo repeats the same fragile code.

Success: the scripts replace their hand-written Markdown with the builders. The generated docs come out the same, except where the old code escaped something wrong. Small changes are fine. Style changes across a document are not.

## Design

A script builds Markdown values, composes them, and calls `toString()` on the outermost one. Escaping happens there, based on where each value ends up, so the script never needs to know the escaping rules.

```ts
import { link, list, paragraph, text } from 'inject-markdown/markdown';

const md = list(extensions.map((e) => paragraph(link(e.url, e.name), text(` - ${e.description}`)))).toString();
```

```markdown
- [Ancient Greek](https://marketplace.visualstudio.com/items?itemName=…) - Adds Ancient Greek …
- [Arabic](https://…) - …
```

A `]` in a name is escaped in the link text. The names in the example are illustrative. The API isn't settled yet.

### What a builder returns

A builder returns a Markdown value, not a string. The value keeps its structure until it's rendered, so a link placed in a table cell can escape `|` without the caller knowing it's in a table.

The node tree (mdast) stays internal. It's too raw for callers, and most don't care.

Turned down:

- Plain strings: a string can't know where it ends up, so a link with `|` in its text would still break a table.
- Raw mdast nodes: they make mdast's types part of the public API and tie it to the remark version.

### Rendering

`toString()` renders a value and everything in it. There's no separate render function. A value also renders inside a template literal (`${value}`), so it drops into existing templates such as `unindent`.

`toString()` takes no options, so a value renders in a fixed default style. When builder output is injected, inject-markdown already re-renders it in the target document's style, so the default only shows when a script writes a file directly.

Converting a value to a string too early loses its kind. `text(`see ${link(…)}`)` makes the link plain text and escapes its brackets. Scripts compose values, not strings.

### Inline and block

Every value is inline or block, as in Markdown:

- **Inline:** text, link, inline code, comment.
- **Block:** heading, list, code block, a paragraph or sequence, comment.

A heading and a paragraph are blocks that hold inline content.

Putting a block where only inline content can go, such as a list inside a heading, is an error:

- At compile time, because the builder types separate inline from block.
- At runtime too, for JavaScript callers and `any` values.

Turned down:

- Runtime only: the scripts are TypeScript, so the types catch most mistakes before the script runs.

### First round

- text, link, inline code
- heading, list, code block
- a paragraph or sequence container, so a list item can hold a link followed by text
- comment
- a placeholder builder
- templates

### Comments

A comment is inline, and it also fits anywhere a block does. That covers block notices such as `cspell:disable` and an inline `cspell:ignore`.

It renders as `<!-- … -->`. The renderer keeps the text from ending the comment early.

Turned down:

- Three dashes (`<!--- … --->`): it was a workaround from when GitHub rendered two-dash comments. Third-party bots (Renovate, Dependabot, CodeRabbit) write two dashes.

### Placeholders

A placeholder builder renders exactly `{@ name @}`, unescaped, so a script can generate Markdown that inject-markdown fills in later.

### Templates

A template is Markdown with `{@ name @}` placeholders, in the same [placeholder](../../glossary.md#placeholder) grammar as injection. A script fills it with strings or Markdown values:

- A string is inserted as text and escaped.
- A placeholder inside a line takes only inline values.
- A placeholder that stands alone as its own paragraph also takes a block, such as a list.
- A placeholder inside inline code or a code block takes only a string or text value. It's a direct replacement, with no Markdown escaping. The common case is a package name in an install command.
- A value of the wrong kind is an error.

The renderer lengthens a code fence when the inserted content needs it.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and the values.

### Where it lives

The builders are built inside inject-markdown first, for rapid development against the scripts that need them, and move to toolbox later.

- inject-markdown depends on the builders, never the other way around. The code lives in its own folder and imports nothing from the rest of inject-markdown.
- The placeholder grammar and substitution move into the builders, so injection and templates share one implementation.
- They're exported as `inject-markdown/markdown`. After the move, inject-markdown keeps exporting them as a pass-through.
- While the API settles, it's documented as experimental. Breaking changes ship as minor releases, called out in the release notes.

Turned down:

- A second package in this repo: it means converting the repo to a monorepo, with its release and CI setup.
- Toolbox from the start: every grammar change would need a toolbox release before inject-markdown could use it.
- Internal only until the move: the scripts couldn't use it while it's being shaped by them.
- `experimental` in the subpath: every import would change once it settles.

## Open questions

- An `MDDocument` that carries its own style (bullets, fences, emphasis) and uses it when rendering.
- The concrete API: names, how a template and its values are passed in, and how values are typed.
- Tables, in a second round.
- Bold and italic, images, and raw HTML, once a script needs them.
- Markdown-valued placeholders at injection time. The placeholder opts in. The syntax is open.

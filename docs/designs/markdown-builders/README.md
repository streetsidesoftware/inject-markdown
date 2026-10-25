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
import { link, list, paragraph } from 'inject-markdown/markdown';

const md = list(extensions.map((e) => paragraph(link(e.name, e.url), ` - ${e.description}`))).toString();
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

### Creating values

A value is created by a factory function, such as `link(…)` or `list(…)`. Each kind is a class underneath. The nodes a value renders as are kept in a module-private `WeakMap`, not on the value, so the public types never mention mdast. The runtime kind check looks a value up there.

The API exports the factories and the types (`MDLink`, `MDList`, and so on), not the classes. Factories are the only way to create a value, so the classes can change while the API settles. If a script needs to tell kinds apart, an exported check such as `isMarkdown(x)` can be added then.

Turned down:

- Classes only (`new MDLink(…)`): nested values get verbose.
- Classes and factories both: two ways to create a value, and twice the surface to keep stable.
- Exporting the classes as values: the constructors and hierarchy become public API, a script could bypass a factory or subclass a kind the renderer doesn't know.

Wherever inline content is accepted, a plain string means text and is escaped. `inlineCode('…')` and `codeBlock('…')` take their string as code, inserted as is. `text()` stays available for a script that wants to be explicit.

Turned down:

- Text only through `text()`: every call gets longer, for no gain in safety.

### Links

`link(content, url)` follows Markdown's `[content](url)` order. The content is a string, an inline value, or an array of them, because link text is often inline code: `link(inlineCode(name), dir)`. The URL is a string or a `URL`. An optional title, if one is ever needed, fits as a third argument.

Turned down:

- `link(url, ...content)`: a title would need an options object, since nothing can follow variadic content.

### Headings

`heading(depth, content)` follows Markdown order, as in `## Title`. The types limit `depth` to 1–6. The content is inline: `heading(2, ['Using ', inlineCode('cspell')])`.

Turned down:

- `heading(content, depth)`: it breaks Markdown order, and an optional depth needs a default.
- `h1(…)` through `h6(…)`: six functions, and a computed level needs a lookup.

### Inline code and comments

`inlineCode(code)` and `comment(text)` each take one string, because code and comment text aren't Markdown. The fence of inline code is longer than any run of backticks in the code.

A placeholder fits in by converting to a string, since its string form is exactly `{@ name @}`: `inlineCode(`version: ${placeholder('engine.version')}`)`.

### Code blocks

`codeBlock(code, lang?)` takes the language last, because it's optional: `codeBlock('npm install -D @cspell/dict-en', 'sh')`. The code is inserted as is. The fence is longer than any run of backticks in the code.

Turned down:

- `codeBlock(lang, code)`: Markdown order, but the language becomes required.

### Documents

`document(...blocks)` makes a block value from several blocks, so a script can render a whole file: `document(heading(3, title), list(items)).toString()`. Arrays of blocks are flattened, so `document(sections, ...more)` works. A document is the one value that renders with a trailing newline, because it's meant to stand alone as a file. It's where a document's own style and frontmatter will go.

Turned down:

- An exported `render(blocks)`: a second way to render, next to `toString()`.
- Joining blocks in the script with `'\n\n'`: every script would need to know the blank-line rule between blocks.
- No trailing newline, like every other value: every script writing a file would add it.

### Sequences and lists

An array is a sequence:

- An array of inline values renders as one line. The pieces are joined exactly as given, with no added spaces: `['Ref: ', link('German', '../g.md')]`.
- An array of blocks renders as blocks.
- An array that mixes inline and block values is an error.

`paragraph(…)` turns inline content into a block explicitly.

`list(entries)` takes one entry per item:

- A string, inline value, or block is a whole item.
- An array is one item holding a sequence. It is never promoted to a nested list.
- `listItem(…)` also makes one item from several pieces. Inline pieces form a line, and blocks follow it, as in a Markdown list item.
- A nested list is a `list(…)` inside an item: `listItem('Languages', list(['English', 'German']))`.

```ts
list([listItem('Languages'), ['Ref: ', link('German', '../g.md')], 'Other']);
```

```markdown
- Languages
- Ref: [German](../g.md)
- Other
```

Turned down:

- An explicit container for every sequence: every list item would need a wrapper.
- Joining inline pieces with a space: a comma, or pieces that must touch such as `` `x`s ``, would need a way to suppress it.

### Rendering

`toString()` renders a value and everything in it, without a trailing newline. There's no separate render function. A value also renders inside a template literal (`${value}`), so it drops into existing templates such as `unindent`.

`toString()` takes no options, so a value renders in a fixed default style. The exception is a filled template, which renders in the style detected from its own text (`detectMarkdownStyle`, moved into the builders for this). When builder output is injected, inject-markdown already re-renders it in the target document's style, so the default only shows when a script writes a file directly.

Converting a value to a string too early loses its kind. `text(`see ${link(…)}`)` makes the link plain text and escapes its brackets. Scripts compose values, not strings.

### Inline and block

Every value is inline or block, as in Markdown:

- **Inline:** text, link, strong, emphasis, strikethrough, inline code, comment.
- **Block:** heading, list, list item, code block, paragraph, comment.

A heading and a paragraph are blocks that hold inline content.

Putting a block where only inline content can go, such as a list inside a heading, is an error:

- At compile time, because the builder types separate inline from block.
- At runtime too, for JavaScript callers and `any` values.

Turned down:

- Runtime only: the scripts are TypeScript, so the types catch most mistakes before the script runs.

### First round

- text, link, inline code
- strong, emphasis, and strikethrough: `strong(content)`, `emphasis(content)`, `strikethrough(content)`
- heading, list, code block
- paragraph and list item, with arrays as sequences
- comment
- a placeholder builder
- templates: `template` for blocks, `inlineTemplate` for inline fragments

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

`template(markdown, values)` fills a template in one call and returns a block value. `values` is a plain object, and dotted names walk into it, as they do at injection time: `template(tpl, { pkg: { name: '@cspell/dict-grc' }, list: list(items) })`. A script that reuses a template keeps the string and calls `template` again.

Turned down:

- `template(markdown).fill(values)`: a second kind of object, for a parse-once speed gain the scripts don't need. It can still be added later.

`inlineTemplate(markdown, values)` fills a fragment the same way and returns an inline value, for use inside a sentence, list item, heading, or link text: `listItem(link(e.name, e.url), inlineTemplate(' - Adds {@ name @} spell checking', e))`.

- Its text must be inline-able: one paragraph. A blank line throws. Block syntax is parsed as text, so `' - Adds …'` is a fragment, not a list. Leading and trailing whitespace is kept.
- Its placeholders take only inline values.

A placeholder with no value is an error. `template` throws and lists the missing names. A script that keeps a placeholder for injection time passes it explicitly. So typos are caught, and every kept placeholder is visible in the script. Any of these work:

- `{ engines: { cspell: placeholder('engines.cspell') } }`
- `{ 'engines.cspell': placeholder('engines.cspell') }`: a key may be a dotted name.
- `{ 'engines.cspell': '{@ engines.cspell @}' }`: escaping text leaves placeholder syntax alone.

A values object resolves names the way injection resolves declarations:

- Each top-level key acts as a declaration, in the object's key order. A top-level key may be a dotted name. Below the top level, a key is a single segment.
- The newest declaration wins: keys are tried from last to first.
- A key matches when it equals the name, or when it equals a leading part of it and the rest of the name resolves inside its value.
- A key that doesn't hold the rest of the name doesn't stop the search. The next earlier key is tried.

```ts
{
    'a.b': { c: 1, e: 5 },
    a: { b: { c: 0, d: 1 } },
}
```

- `a.b.c` is `0`: the later key `a` wins.
- `a.b.d` is `1`, from `a`.
- `a.b.e` is `5`: `a` has no `e`, so `'a.b'` is tried.

JavaScript moves integer-like keys, such as `'2'`, to the front of the key order. That only matters for a name whose first segment is all digits.

Turned down:

- The exact key first, then the nested walk: it ignores the order a reader sees, and mixed forms such as `{ 'a.b': { c: 1 } }` for `a.b.c` don't resolve.
- The longest matching key first: a later key couldn't override an earlier, longer one.
- Defining a name both ways is an error: it rejects objects that have a clear reading.

`placeholder(…)` is a text value, so it's also accepted inside inline code and code blocks. That's the `requirements.md` case, where `` `{@ engines.cspell @}` `` is inline code.

Turned down:

- Leaving it as written, silently: a typo reaches the generated file.
- Leaving it as written, with a `strict` option: the safe behavior would be opt-in.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and the values.

### Errors

A value of the wrong kind throws a `TypeError`, such as a block where only inline content can go, or an array that mixes inline and block values. Other misuse throws an `Error`, such as a template placeholder with no value or a heading depth outside 1–6. Each message names what was wrong: `heading content must be inline, got a list`.

A builders-specific error class waits until a caller needs to catch one specifically. inject-markdown's `OptionError` isn't used, because the builders import nothing from the rest of inject-markdown.

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

### Tests

- Unit tests next to each builder, built from the escaping failures found in the repos: `]` in link text, a backtick in inline code, a fence inside a code block, `-->` in a comment, and inline versus block errors.
- Template tests for the resolve order, missing names, kept placeholders, and placeholders inside code.
- The existing placeholder and injection tests pass unchanged after the placeholder code moves, which shows injection behavior didn't change.
- Fixtures are fine, kept with the builders' code rather than mixed into the injection fixtures under `fixtures/`, so they move to toolbox along with it.

### Release

A `feat:` release. It isn't breaking: the subpath is new, and the placeholder code moving underneath doesn't change injection behavior.

The user guide (`docs/guide/markdown-builders.md`, marked experimental) and a short README section linking to it are written once the feature is built, not during development.

## Open questions

- `MDDocument` options: its own style (bullets, fences, emphasis), and frontmatter.
- The concrete API: names, how a template and its values are passed in, and how values are typed.
- At injection time, a values file's top-level dotted keys aren't read as dotted names: `getPath` walks one segment at a time. Should values files follow the values-object rule?
- The kind check fails when two copies of the package are loaded, for example the builders loaded both directly and through inject-markdown's pass-through after the move to toolbox. Each copy has its own `WeakMap`, just as `instanceof` would fail. A shared brand may be needed then.
- Tables, in a second round.
- Images and raw HTML, once a script needs them.
- Markdown-valued placeholders at injection time. The placeholder opts in. The syntax is open.

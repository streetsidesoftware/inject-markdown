# Markdown builders

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
import { link, list } from 'inject-markdown/markdown';

const md = list(extensions.map((e) => [link(e.name, e.url), ` - ${e.description}`])).toString();
```

```markdown
- [Ancient Greek](https://marketplace.visualstudio.com/items?itemName=…) - Adds Ancient Greek …
- [Arabic](https://…) - …
```

A `]` in a name is escaped in the link text. The names in the example are illustrative. The API isn't settled yet.

### What a builder returns

A builder returns a Markdown value, not a string. The value keeps its structure until it's rendered, so a link placed in a table cell can escape `|` without the caller knowing it's in a table.

The node tree (mdast) stays internal. It's too raw for callers, and most don't care.

### Creating values

A value is created by a factory function, such as `link(…)` or `list(…)`. The public types (`MDLink`, `MDList`, and so on) are interfaces: a kind, a description, and `toString()`. Underneath, one internal class carries the nodes a value renders as, under the key `Symbol.for('@streetsidesoftware/markdown-builders.value')`. Having that key is what the runtime kind check looks for.

- The interfaces never mention mdast.
- The key comes from the global symbol registry, so a value made by another loaded copy of the builders is recognized. That happens after the move to toolbox, when a script loads the builders both directly and through inject-markdown's pass-through.
- The key names the package the builders move to, `@streetsidesoftware/markdown-builders`. If what's stored under it ever changes incompatibly, a new key such as `….value.1` can be used.
- The key is a brand, not privacy: anyone can read it.

Factories are the only way to create a value, so the internal class can change while the API settles. `isMarkdown(x)` tells a Markdown value from anything else.

Wherever inline content is accepted, a plain string means text and is escaped. `inlineCode('…')` and `codeBlock('…')` take their string as code, inserted as is. `inlineText()`, or its short name `text()`, stays available for a script that wants to be explicit.

### Plain text

A string is inline text everywhere, even where blocks can go. A newline in it stays in the text and displays as a space. A string never splits into paragraphs by itself, because going from inline to block depends on what the caller means.

`blockText(text)` says it: plain text becomes paragraphs, as if each line were escaped text and the result were read as Markdown.

- A blank line, or a line of only spaces and tabs, ends a paragraph.
- A newline between other lines is a soft break, so text wrapped at 80 columns reads as normal paragraphs.
- Each line is escaped, so a line such as `- b` or `# c` stays text.
- Blank lines at the start and end are dropped.
- The result is always blocks, an `MDFragment`, even for one paragraph.

```ts
document(heading(2, 'Notice'), blockText('Line one\nline two.\n\nNext paragraph.\n'));
```

```markdown
## Notice

Line one
line two.

Next paragraph.
```

### Links

`link(content, url)` follows Markdown's `[content](url)` order. The content is a string, an inline value, or an array of them, because link text is often inline code: `link(inlineCode(name), dir)`. The URL is a string or a `URL`. An optional title, if one is ever needed, fits as a third argument.

### Headings

`heading(depth, content)` follows Markdown order, as in `## Title`. The types limit `depth` to 1–6. The content is inline: `heading(2, ['Using ', inlineCode('cspell')])`.

### Inline code and comments

`inlineCode(code)` and `comment(text)` each take one string, because code and comment text aren't Markdown. The fence of inline code is longer than any run of backticks in the code.

A placeholder fits in by converting to a string, since its string form is exactly `{@ name @}`: `inlineCode(`version: ${placeholder('engine.version')}`)`.

### Code blocks

`codeBlock(code, lang?)` takes the language last, because it's optional: `codeBlock('npm install -D @cspell/dict-en', 'sh')`. The code is inserted as is. The fence is longer than any run of backticks in the code.

### Documents

`document(...content)` makes a block value from its content, so a script can render a whole file: `document(heading(3, title), list(items)).toString()`. Arrays are flattened, so `document(sections, ...more)` works. Inline pieces in a row form a paragraph, and blocks follow, as in a list item: `document('See ', link(…), '.')` is one paragraph. A document is the one value that renders with a trailing newline, because it's meant to stand alone as a file. It's where a document's own frontmatter will go.

A document can carry its own style:

- `doc.withStyle(style)` returns a copy of the document that renders in that style. Fields the style leaves out keep the default.
- `MarkdownStyle` is the builders' own interface, with the fields a style read from a file can have: `bullet`, `bulletOrdered`, `emphasis`, `strong`, `fence`, `fences`, `incrementListMarker`, and `rule`. Each takes a named literal type, such as `BulletMarker`. More fields are added when a script needs them.
- `detectStyle(markdown)` reads the style an existing file uses, so a script can match it: `document(...).withStyle(detectStyle(existing))`. A construct the file doesn't use gets the default.
- Everything inside a document renders in the document's style. A template's own detected style applies only when the template is rendered by itself.

### Flavors

A document renders for a target flavor. It's built in round two, with tables, because its first user, vscode-spell-checker's Docusaurus site, mostly writes tables.

- `'github'` is the default: GitHub's Markdown.
- `doc.withFlavor('mdx')` returns a copy of the document that renders as valid MDX. Docusaurus 3 parses even `.md` files as MDX.
- Flavor is separate from style. A style chooses between equivalent forms and can be detected from a file. A flavor decides what is valid, and only the script knows its target.
- In `'mdx'`:
  - `{` and `<` in text are escaped.
  - A comment renders as `{/* … */}`. Docusaurus accepts `<!-- -->` today only through its MDX 1 compatibility setting, which its v4 defaults turn off.
  - Raw HTML is valid JSX, as `<br/>` already is.
  - A kept placeholder throws when rendering. `{@ name @}` is an invalid MDX expression, and an `'mdx'` document is final output.
- Flavor-only constructs, such as GitHub alerts (`> [!NOTE]`) and Docusaurus admonitions (`:::note`), wait until a script needs them.

### Sequences and lists

An array is a sequence:

- An array of inline values renders as one line. The pieces are joined exactly as given, with no added spaces: `['Ref: ', link('German', '../g.md')]`.
- An array of blocks renders as blocks.
- An array that mixes inline and block values is an error.

`paragraph(…)` turns inline content into a block explicitly.

`toBlock(content)` makes content fit where only blocks can go. Blocks come back unchanged, and each run of inline pieces becomes a paragraph, as in a list item: `toBlock(['Intro ', link(…), list([…])])` is a paragraph followed by the list. It's how the result of `template()` or `parse()`, which can be either kind, goes where only blocks can go.

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

### Rendering

`toString()` renders a value and everything in it, without a trailing newline. There's no separate render function. A value also renders inside a template literal (`${value}`), so it drops into existing templates such as `unindent`.

`toString()` takes no options, so a value renders in a fixed default style. The exceptions are a document given a style with `withStyle`, and a fragment from `template()` or `parse()`, which renders in the style detected from its own text (`detectMarkdownStyle`, moved into the builders for this). When builder output is injected, inject-markdown already re-renders it in the target document's style, so the default only shows when a script writes a file directly.

A line ending or `lineBreak()` at the start or end of a paragraph, heading, or table cell is dropped. Nothing is on its other side, so it can't display, and kept it would render as `&#xA;` or a literal `\`.

Converting a value to a string too early loses its kind. `text(`see ${link(…)}`)` makes the link plain text and escapes its brackets. Scripts compose values, not strings.

### Inline and block

Every value is inline or block, as in Markdown:

- **Inline:** text, link, strong, emphasis, strikethrough, inline code, line break, comment.
- **Block:** heading, list, list item, code block, paragraph, comment.

A heading and a paragraph are blocks that hold inline content.

Putting a block where only inline content can go, such as a list inside a heading, is an error:

- At compile time, because the builder types separate inline from block.
- At runtime too, for JavaScript callers and `any` values.

### First round

- text, link, inline code
- strong, emphasis, and strikethrough: `strong(content)`, `emphasis(content)`, `strikethrough(content)`
- heading, list, code block
- paragraph and list item, with arrays as sequences
- line breaks: `lineBreak()` and `br()`
- comment
- placeholder builders: `placeholder` and `blockPlaceholder`
- templates: `template`, `blockTemplate`, and `inlineTemplate`
- `parse`, for Markdown made elsewhere
- `inlineText` and `blockText`, for plain text
- `substitutePlaceholders`, for content built in steps
- `toBlock`

### Line breaks

There are two line-break values, both inline:

- `lineBreak()` breaks the line in the form that works where it ends up. In a paragraph or list item that's a Markdown hard break (`\` and a newline). In a table cell, where a Markdown break can't go, it's `<br/>`.
- `br()` is always `<br/>`, for a script that wants the HTML form everywhere.

Both write `<br/>`, never `<br>`: MDX reads HTML as JSX, where an unclosed `<br>` is a syntax error.

### Comments

A comment is inline, and it also fits anywhere a block does. That covers block notices such as `cspell:disable` and an inline `cspell:ignore`.

It renders as `<!-- … -->`. The renderer keeps the text from ending the comment early.

### Placeholders

A placeholder renders exactly `{@ name @}`, unescaped, so a script can generate Markdown that a later step or inject-markdown fills in. A placeholder isn't inline or block by itself. It's a slot, and where it sits decides what it can take:

- Inside a line, it takes only inline content.
- On a line of its own, where blocks can go, it also takes blocks.
- Inside code, it takes only a string or text.

Where a placeholder sits is the same whether it's written in Markdown text, in a string, or made with a builder:

- `placeholder(name)` (`MDPlaceholder`) goes anywhere inline content does, and inside code. `document('Fruit:\n', placeholder('fruit'), '\n', link(…))` puts it on a line of its own, so it can take a list.
- Inline pieces in a row join into one line, so `document('Fruit:', placeholder('fruit'))` puts it inside the line. `blockPlaceholder(name)` (`MDBlockPlaceholder`) is a block, so it always stands on its own lines and takes blocks or inline content. Inside a line it's an error, as for any block.
- A placeholder is rendered as is. A line ending before it stays a line ending, so a placeholder written on its own line is still on its own line in the output.

```ts
document('Fruit:', blockPlaceholder('fruit'));
```

```markdown
Fruit:

{@ fruit @}
```

### Templates

A template is Markdown with `{@ name @}` placeholders, in the same [placeholder](../../glossary.md#placeholder) grammar as injection. A script fills it with strings or Markdown values:

- A string is inserted as text and escaped.
- A placeholder inside a line takes only inline values.
- A placeholder that is a whole line also takes blocks, such as a list. Its paragraph splits around them, as it would around a list written in place: `Fruit:\n{@ fruit @}` gives `Fruit:` and then the list.
- A placeholder inside inline code or a code block takes only a string or text value. It's a direct replacement, with no Markdown escaping. The common case is a package name in an install command.
- A value of the wrong kind is an error.

The renderer lengthens a code fence when the inserted content needs it.

There are three template functions. Each fills a template in one call:

- `template(markdown, values)` parses the text as Markdown. The filled result decides its kind: a single paragraph is inline, without the whitespace around it, and anything else is blocks. A lone `{@ list @}` is inline when its value is text, and a block when its value is a list. Checking `kind` narrows the result, and `toBlock()` puts it where blocks go.
- `blockTemplate(markdown, values)` is the same, but always returns blocks. A single paragraph stays a paragraph.
- `inlineTemplate(markdown, values)` is for a fragment, described below.

`values` is a plain object, and dotted names walk into it, as they do at injection time: `template(tpl, { pkg: { name: '@cspell/dict-grc' }, list: list(items) })`. A script that reuses a template keeps the string and calls `template` again.

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

`placeholder(…)` is also accepted inside inline code and code blocks. That's the `requirements.md` case, where `` `{@ engines.cspell @}` `` is inline code.

The concerns that apply at injection time, such as untrusted values and link rebasing, don't apply here. The same script owns the template and the values.

### Markdown made elsewhere

`parse(markdown)` brings in Markdown text that is already written, such as a `markdownDescription` from a `package.json`. It's `template()` without the filling:

- A single paragraph is inline, without the whitespace around it. Anything else is blocks.
- A `{@ name @}` placeholder is kept as written, the same as in `text()`, so injection can fill it later. Rendering never escapes it.
- The result renders in the style detected from its own text. Inside a document, the document's style applies.

`template()` and `parse()` return the same types: `MDFragment` for blocks and `MDInlineFragment` for inline content. Callers narrow on `kind`, so the types don't record which function made the value. There are no forced forms like `blockTemplate()` yet. `toBlock(parse(markdown))` gives blocks.

In prose, the Markdown parser reads `\{` as an escape and drops the backslash, so `\{@ name @}` comes out as a kept placeholder. Templates and injection have the same problem ([#887](https://github.com/streetsidesoftware/inject-markdown/issues/887)).

### Substituting placeholders

`substitutePlaceholders(value, values)` puts values in place of the placeholders of a value already made, such as one from `parse()`:

- It takes any Markdown value. The result is the same type, in the same style, when the value can hold what was substituted: a document stays a document, and a fragment keeps its text's style.
- Only the names that `values` has are substituted. The others stay as written, so content can be built in steps, and injection can fill what's left.
- Values go in as in templates, and `values` resolves names the same way. A placeholder that is a whole line takes blocks wherever blocks can go. Inside a line, such as in a heading, a block throws a `TypeError`.
- A value that can't hold what was substituted becomes a fragment of it. The return type, `SubstitutedValue<T>`, says which values can change:
  - Text stays text when every value is a string or text. A link makes it an inline fragment, and blocks on a line of their own make it an `MDFragment`.
  - An inline fragment or a paragraph that takes blocks becomes an `MDFragment`. That includes a value that is only a placeholder: `parse('{@ x @}')` given a list becomes the list, as in `template()`.
  - A placeholder with a value becomes a fragment of it. `blockPlaceholder()` always becomes blocks.
- The value given is left unchanged.

```ts
const notice = parse('Requires {@ engines.vscode @}.\n\n{@ list @}\n');
const step = substitutePlaceholders(notice, { list: list(items) });
document(step).toString(); // `{@ engines.vscode @}` is kept, for injection.
```

### Errors

A value of the wrong kind throws a `TypeError`, such as a block where only inline content can go, or an array that mixes inline and block values. Other misuse throws an `Error`, such as a template placeholder with no value or a heading depth outside 1–6. Each message names what was wrong: `heading content must be inline, got a list`.

A builders-specific error class waits until a caller needs to catch one specifically. inject-markdown's `OptionError` isn't used, because the builders import nothing from the rest of inject-markdown.

### Where it lives

The builders are built inside inject-markdown first, for rapid development against the scripts that need them, and move to toolbox later, as `@streetsidesoftware/markdown-builders`.

- inject-markdown depends on the builders, never the other way around. The code lives in its own folder and imports nothing from the rest of inject-markdown.
- The placeholder grammar and substitution move into the builders, so injection and templates share one implementation.
- They're exported as `inject-markdown/markdown`. After the move, inject-markdown keeps exporting them as a pass-through.
- While the API settles, it's documented as experimental. Breaking changes ship as minor releases, called out in the release notes.

### Tests

- Unit tests next to each builder, built from the escaping failures found in the repos: `]` in link text, a backtick in inline code, a fence inside a code block, `-->` in a comment, and inline versus block errors.
- Template tests for the resolve order, missing names, kept placeholders, and placeholders inside code.
- The existing placeholder and injection tests pass unchanged after the placeholder code moves, which shows injection behavior didn't change.
- Fixtures are fine, kept with the builders' code rather than mixed into the injection fixtures under `fixtures/`, so they move to toolbox along with it.

### Release

A `feat:` release. It isn't breaking: the subpath is new, and the placeholder code moving underneath doesn't change injection behavior.

The user guide (`docs/guide/markdown-builders.md`, marked experimental) and a short README section linking to it are written once the feature is built, not during development.

## Open questions

- `MDDocument` frontmatter.
- The concrete API: names, how a template and its values are passed in, and how values are typed.
- At injection time, a values file's top-level dotted keys aren't read as dotted names: `getPath` walks one segment at a time. Should values files follow the values-object rule?
- Tables and flavors, in a second round.
- Images and raw HTML, once a script needs them.
- Markdown-valued placeholders at injection time. The placeholder opts in. The syntax is open.

## Alternatives

- Exported classes, checked with `instanceof`, or nodes kept in a module-private `WeakMap`: a value made by another loaded copy of the builders wouldn't be recognized.
- remark-stringify's options as the style type: the public types would import remark and tie the API to its version.
- `h1(…)` through `h6(…)`: six functions, and a computed level needs a lookup.
- A style passed to `toString(style)`: a template literal calls `toString()` with no arguments.
- A separate `render(value)`: a second way to render, next to `toString()`.
- Joining inline pieces with a space: a comma, or pieces that must touch such as `` `x`s ``, would need a way to suppress it.
- Three-dash comments (`<!--- … --->`), as in inject-markdown's own directives: a workaround from when GitHub rendered two-dash comments. Third-party bots (Renovate, Dependabot, CodeRabbit) write two dashes.
- `template(markdown).fill(values)`: a second kind of object, for a parse-once speed gain the scripts don't need. It can still be added later.
- Trying the exact key first, then the nested walk: it ignores the order a reader sees, and mixed forms such as `{ 'a.b': { c: 1 } }` for `a.b.c` don't resolve.
- Trying the longest matching key first: a later key couldn't override an earlier, longer one.
- Leaving a placeholder with no value as written, as injection does: a typo reaches the generated file. A `strict` option would make the safe behavior opt-in.
- A second package in this repo: it means converting the repo to a monorepo, with its release and CI setup.
- Toolbox from the start: every grammar change would need a toolbox release before inject-markdown could use it.
- `experimental` in the subpath: every import would change once it settles.
- `text()` deciding its kind by its content, as `parse()` does: its type would become `MDText | MDFragment`, and `heading(2, text(s))` would stop type-checking.
- Splitting a string into paragraphs wherever blocks can go: the same string would mean something different in a list item than in a paragraph.
- A newline in `blockText()` as a line break: text wrapped at a fixed width would break in the middle of sentences.
- Always returning the same type, with values that don't fit throwing: text given a link, or a paragraph given a list, would throw, and the caller would have to rebuild the value to fit.
- Only one placeholder builder, whose kind follows where it ends up: inline pieces in a row join into one line, so `document('Fruit:', placeholder('fruit'))` puts it inside the line, and it could never take a list.
- `placeholder()` taking only inline content, even on a line of its own: it would behave differently from the same placeholder written in a string, and a script would need `blockPlaceholder()` to write a placeholder it had already put on its own line.
- A placeholder kept as an HTML node: the stringifier turns a line ending before HTML into a space, so a placeholder written on its own line would end up inside the line before it.
- One `MDPlaceholder` type with a `kind` of `'inline' | 'block'`: the compiler couldn't keep a block placeholder out of a line.
- Only a placeholder that is a whole paragraph taking blocks: `Fruit:\n{@ fruit @}` would throw, though a list written in its place starts right after `Fruit:`.
- `fill(value, values)` or `replacePlaceholders(value, values)`: the function puts a value in place of each placeholder that has one, which is substitution.

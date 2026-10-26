import { describe, expect, test, vi } from 'vitest';

import type { MDValue } from './index.mjs';
import {
    blockPlaceholder,
    blockText,
    br,
    codeBlock,
    comment,
    detectStyle,
    document,
    emphasis,
    heading,
    horizontalRule,
    hr,
    inlineCode,
    inlineText,
    isMarkdown,
    lineBreak,
    link,
    list,
    listItem,
    paragraph,
    placeholder,
    strikethrough,
    strong,
    template,
    text,
    toBlock,
} from './index.mjs';

describe('escaping', () => {
    test.each`
        value                                               | expected
        ${link('a]b[c', '../a.md')}                         | ${'[a\\]b\\[c](../a.md)'}
        ${link(inlineCode('@cspell/dict-en'), '../en')}     | ${'[`@cspell/dict-en`](../en)'}
        ${link('docs', new URL('https://example.com/a b'))} | ${'[docs](https://example.com/a%20b)'}
        ${inlineCode('a`b')}                                | ${'``a`b``'}
        ${text('*not* emphasis')}                           | ${'\\*not\\* emphasis'}
        ${comment('a --> b')}                               | ${'<!-- a -- > b -->'}
        ${comment('cspell:disable')}                        | ${'<!-- cspell:disable -->'}
    `('$expected', ({ value, expected }) => {
        expect(value.toString()).toBe(expected);
    });

    test('a code block fence is longer than any fence in the code', () => {
        expect(codeBlock('```js\nx\n```', 'md').toString()).toBe('````md\n```js\nx\n```\n````');
    });

    test('block syntax at the start of an item is escaped', () => {
        expect(list(['- not a list', '1. not ordered']).toString()).toBe('- \\- not a list\n- 1\\. not ordered');
    });
});

describe('placeholders', () => {
    test('a placeholder renders as written', () => {
        expect(placeholder('engines.cspell').toString()).toBe('{@ engines.cspell @}');
    });

    test('escaping text leaves placeholder syntax alone', () => {
        expect(text('{@ _a_b.c-d @} and *x*').toString()).toBe('{@ _a_b.c-d @} and \\*x\\*');
    });

    test('a placeholder fits inside inline code as a string', () => {
        expect(inlineCode(`version: ${placeholder('engine.version')}`).toString()).toBe(
            '`version: {@ engine.version @}`',
        );
    });

    test('an invalid name throws', () => {
        expect(() => placeholder('-bad')).toThrow('invalid placeholder name');
    });
});

describe('composing', () => {
    test('a list of links', () => {
        const extensions = [
            { name: 'Ancient Greek', url: 'https://example.com/grc', description: 'Adds Ancient Greek' },
            { name: 'Arabic', url: 'https://example.com/ar', description: 'Adds Arabic' },
        ];
        const md = list(extensions.map((e) => paragraph(link(e.name, e.url), ` - ${e.description}`)));
        expect(md.toString()).toBe(
            '- [Ancient Greek](https://example.com/grc) - Adds Ancient Greek\n- [Arabic](https://example.com/ar) - Adds Arabic',
        );
    });

    test('an array entry is one item, never a nested list', () => {
        const md = list([listItem('Languages'), ['Ref: ', link('German', '../g.md')], 'Other']);
        expect(md.toString()).toBe('- Languages\n- Ref: [German](../g.md)\n- Other');
    });

    test('a nested list is a list inside an item', () => {
        const md = list([listItem('Languages', list(['English', 'German'])), 'Other']);
        expect(md.toString()).toBe('- Languages\n  - English\n  - German\n- Other');
    });

    test('a list item with a code block', () => {
        const md = list([listItem('Install:', codeBlock('npm install -D @cspell/dict-en', 'sh'))]);
        expect(md.toString()).toBe('- Install:\n  ```sh\n  npm install -D @cspell/dict-en\n  ```');
    });

    test('a heading with inline content', () => {
        expect(heading(2, ['Using ', inlineCode('cspell')]).toString()).toBe('## Using `cspell`');
    });

    test('inline pieces are joined as given', () => {
        expect(paragraph([inlineCode('x'), 's'], ', ', comment('cspell:ignore xs')).toString()).toBe(
            '`x`s, <!-- cspell:ignore xs -->',
        );
    });

    test('a value renders inside a template literal', () => {
        expect(`See ${link('docs', 'https://example.com')}.`).toBe('See [docs](https://example.com).');
    });

    test('isMarkdown', () => {
        expect(isMarkdown(text('x'))).toBe(true);
        expect(isMarkdown('x')).toBe(false);
        expect(isMarkdown({ kind: 'inline', description: 'text', text: 'x' })).toBe(false);
    });

    test('a value from another loaded copy is recognized', async () => {
        vi.resetModules();
        const other = await import('./index.mjs');
        expect(other.link).not.toBe(link);
        const item = other.listItem(other.link('docs', 'https://example.com'));
        expect(isMarkdown(item)).toBe(true);
        expect(list([item, strong('x')]).toString()).toBe('- [docs](https://example.com)\n- **x**');
    });
});

describe('strong, emphasis, strikethrough', () => {
    test.each`
        value                                             | expected
        ${strong('pre-release')}                          | ${'**pre-release**'}
        ${emphasis('note')}                               | ${'_note_'}
        ${strikethrough(inlineCode('cSpell.oldSetting'))} | ${'~~`cSpell.oldSetting`~~'}
        ${strong(['When: ', emphasis('always')])}         | ${'**When: _always_**'}
    `('$expected', ({ value, expected }) => {
        expect(value.toString()).toBe(expected);
    });

    test('in a list item', () => {
        const md = list([listItem(link('Danish', '../da.md'), ' ', strong('pre-release'), ' - Adds Danish')]);
        expect(md.toString()).toBe('- [Danish](../da.md) **pre-release** - Adds Danish');
    });

    test('block content throws', () => {
        // @ts-expect-error a list is not inline
        expect(() => strong(list(['a']))).toThrow(new TypeError('strong content must be inline, got a list'));
    });
});

describe('line breaks', () => {
    test('lineBreak is a Markdown hard break in a paragraph', () => {
        expect(paragraph('one', lineBreak(), 'two').toString()).toBe('one\\\ntwo');
    });

    test('lineBreak in a list item', () => {
        expect(list([['one', lineBreak(), 'two']]).toString()).toBe('- one\\\n  two');
    });

    test('br is always <br/>', () => {
        expect(paragraph('one', br(), 'two').toString()).toBe('one<br/>two');
        expect(heading(2, ['A', br(), 'B']).toString()).toBe('## A<br/>B');
    });
});

describe('toBlock', () => {
    test('a block is returned unchanged', () => {
        const block = list(['a']);
        expect(toBlock(block)).toBe(block);
        const blocks = [heading(2, 'A'), list(['a'])];
        expect(toBlock(blocks)).toBe(blocks);
    });

    test('inline content becomes a paragraph', () => {
        expect(document(toBlock('Hello')).toString()).toBe('Hello\n');
        expect(document(toBlock(['See ', link('docs', 'u')])).toString()).toBe('See [docs](u)\n');
    });

    test('each inline run becomes a paragraph, and blocks stay', () => {
        const md = document(toBlock(['Intro ', strong('x'), list(['a']), 'Outro']));
        expect(md.toString()).toBe('Intro **x**\n\n- a\n\nOutro\n');
    });
});

describe('text', () => {
    test('text is inlineText', () => {
        expect(text).toBe(inlineText);
    });

    test('a newline stays in the text', () => {
        expect(paragraph(inlineText('a\n- b')).toString()).toBe('a\n\\- b');
    });
});

describe('placeholders', () => {
    test('placeholder() is inline, and blockPlaceholder() is a block', () => {
        expect(placeholder('a.b')).toMatchObject({ kind: 'inline', description: 'a placeholder', name: 'a.b' });
        expect(blockPlaceholder('a.b')).toMatchObject({ kind: 'block', description: 'a block placeholder' });
        expect(heading(2, ['v', placeholder('v')]).toString()).toBe('## v{@ v @}');
        expect(document('Intro', blockPlaceholder('x')).toString()).toBe('Intro\n\n{@ x @}\n');
    });

    test('a block placeholder cannot go inside a line', () => {
        // @ts-expect-error a block placeholder is a block
        expect(() => heading(2, blockPlaceholder('x'))).toThrow(
            new TypeError('heading content must be inline, got a block placeholder'),
        );
    });

    test('an invalid name throws', () => {
        expect(() => blockPlaceholder('a..b')).toThrow(new Error('invalid placeholder name: "a..b"'));
    });
});

describe('horizontalRule', () => {
    test('a line between sections, in the document style', () => {
        expect(hr).toBe(horizontalRule);
        const md = document(paragraph('A'), horizontalRule(), 'B');
        expect(md.toString()).toBe('A\n\n---\n\nB\n');
        expect(md.withStyle({ rule: '*' }).toString()).toBe('A\n\n***\n\nB\n');
    });

    test('it cannot go inside a line', () => {
        // @ts-expect-error a horizontal rule is a block
        expect(() => paragraph(hr())).toThrow(new TypeError('paragraph content must be inline, got a horizontal rule'));
    });
});

describe('line endings at the edges', () => {
    test.each`
        value                                                                  | expected
        ${document('Fruit:\n', placeholder('fruit'), '\n')}                    | ${'Fruit:\n{@ fruit @}\n'}
        ${document(document('Fruit:\n', placeholder('fruit'), '\n'), 'yummy')} | ${'Fruit:\n{@ fruit @}\n\nyummy\n'}
        ${document('Fruit:\n', blockPlaceholder('fruit'))}                     | ${'Fruit:\n\n{@ fruit @}\n'}
        ${document('Intro', '\n', list(['x']))}                                | ${'Intro\n\n- x\n'}
        ${list([listItem('Langs\n', list(['en']))])}                           | ${'- Langs\n  - en'}
        ${paragraph('\n\na\nb\nc  \n\n')}                                      | ${'a\nb\nc'}
        ${heading(2, 'Title\n')}                                               | ${'## Title'}
        ${paragraph('a', lineBreak())}                                         | ${'a'}
        ${paragraph(lineBreak(), 'a', lineBreak(), 'b')}                       | ${'a\\\nb'}
        ${document('Fruit:\n', placeholder('fruit'), '\n', 'yummy')}           | ${'Fruit:\n{@ fruit @}\nyummy\n'}
    `('$expected', ({ value, expected }: { value: MDValue; expected: string }) => {
        expect(value.toString()).toBe(expected);
    });
});

describe('blockText', () => {
    test.each`
        value                   | expected
        ${'a\nb\n\nc\n'}        | ${'a\nb\n\nc'}
        ${'one line'}           | ${'one line'}
        ${'a\n \t\nb'}          | ${'a\n\nb'}
        ${'\n\na\n\n\n\nb\n\n'} | ${'a\n\nb'}
        ${'a\r\n\r\nb\rc'}      | ${'a\n\nb\nc'}
        ${'a\n- b\n# c\n1. d'}  | ${'a\n\\- b\n\\# c\n1\\. d'}
        ${'a\n===\n\n    code'} | ${'a\n\\===\n\n&#x20;   code'}
        ${'a  \nb'}             | ${'a &#x20;\nb'}
        ${'see {@ x @}\n\n*b*'} | ${'see {@ x @}\n\n\\*b\\*'}
        ${''}                   | ${''}
    `('blockText($value)', ({ value, expected }: { value: string; expected: string }) => {
        expect(blockText(value).toString()).toBe(expected);
    });

    test('a single paragraph is still blocks', () => {
        const md = blockText('a\nb');
        expect(md.kind).toBe('block');
        expect(document(md, list(['x'])).toString()).toBe('a\nb\n\n- x\n');
    });
});

describe('document', () => {
    test('blocks render as a file, ending with one newline', () => {
        const md = document(heading(3, 'Languages'), list(['en', 'de']));
        expect(md.toString()).toBe('### Languages\n\n- en\n- de\n');
    });

    test('arrays of blocks are flattened', () => {
        const sections = [heading(3, 'A'), list(['a'])];
        const md = document(sections, [heading(3, 'B'), [list(['b'])]]);
        expect(md.toString()).toBe('### A\n\n- a\n\n### B\n\n- b\n');
    });

    test('withStyle renders a copy in the given style', () => {
        const md = document(list(['a', emphasis('b'), strong('c')]), codeBlock('x'));
        const styled = md.withStyle({ bullet: '*', emphasis: '*', strong: '_', fence: '~' });
        expect(styled.toString()).toBe('* a\n* *b*\n* __c__\n\n~~~\nx\n~~~\n');
        expect(md.toString()).toBe('- a\n- _b_\n- **c**\n\n```\nx\n```\n');
    });

    test('a field left out keeps the default', () => {
        const md = document(list([emphasis('b')])).withStyle({ bullet: undefined, emphasis: '*' });
        expect(md.toString()).toBe('- *b*\n');
    });

    test('withStyle replaces the earlier style', () => {
        const md = document(list([emphasis('b')]))
            .withStyle({ bullet: '*', emphasis: '*' })
            .withStyle({ bullet: '+' });
        expect(md.toString()).toBe('+ _b_\n');
    });

    test('a template inside renders in the document style', () => {
        const md = document(toBlock(template('* a\n* b\n', {}))).withStyle({ bullet: '+' });
        expect(md.toString()).toBe('+ a\n+ b\n');
    });

    test('detectStyle reads the style an existing file uses', () => {
        const existing = '# Title\n\n* one\n* two\n\nSome *em* and __strong__.\n\n~~~\ncode\n~~~\n';
        const style = detectStyle(existing);
        expect(style).toMatchObject({ bullet: '*', emphasis: '*', strong: '_', fence: '~' });
        expect(
            document(list([emphasis('x')]))
                .withStyle(style)
                .toString(),
        ).toBe('* *x*\n');
    });

    test('inline pieces in a row form a paragraph, as in a list item', () => {
        const md = document('See ', link('the docs', 'u'), '.', list(['a']), 'More');
        expect(md.toString()).toBe('See [the docs](u).\n\n- a\n\nMore\n');
    });

    test('a string is inline text and never splits', () => {
        expect(document('a\n\nb').toString()).toBe('a&#xA;&#xA;b\n');
    });

    test('a list item is not document content', () => {
        // @ts-expect-error a list item goes only in a list
        expect(() => document(listItem('a'))).toThrow(
            new TypeError('document content must be inline, got a list item'),
        );
    });
});

describe('errors', () => {
    test('a block where only inline content can go', () => {
        // @ts-expect-error a list is not inline
        expect(() => heading(2, list(['a']))).toThrow(new TypeError('heading content must be inline, got a list'));
    });

    test('an array that mixes inline and blocks', () => {
        // @ts-expect-error a code block is not inline
        expect(() => paragraph(['a', codeBlock('x')])).toThrow(TypeError);
    });

    test('a heading depth outside 1 to 6', () => {
        // @ts-expect-error 7 is not a heading depth
        expect(() => heading(7, 'x')).toThrow('heading depth must be 1 to 6, got 7');
    });
});

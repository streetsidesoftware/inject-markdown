import { describe, expect, test } from 'vitest';

import {
    codeBlock,
    comment,
    document,
    heading,
    inlineCode,
    isMarkdown,
    link,
    list,
    listItem,
    paragraph,
    placeholder,
    text,
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

    test('inline content is not a block', () => {
        // @ts-expect-error a string is not a block
        expect(() => document('text')).toThrow(new TypeError('document content must be blocks, got a string'));
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

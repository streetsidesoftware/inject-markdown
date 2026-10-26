import { describe, expect, test } from 'vitest';

import {
    blockTemplate,
    codeBlock,
    document,
    heading,
    inlineCode,
    inlineTemplate,
    link,
    list,
    listItem,
    parse,
    placeholder,
    template,
    text,
    toBlock,
} from './index.mjs';
import { resolveValue } from './template.js';

describe('resolveValue', () => {
    const laterNested = { 'a.b': { c: 1, e: 5 }, a: { b: { c: 0, d: 1 } } };
    const laterDotted = { a: { b: { c: 0, d: 1 } }, 'a.b': { c: 1 } };

    test.each`
        values         | name       | expected
        ${laterNested} | ${'a.b.c'} | ${0}
        ${laterNested} | ${'a.b.d'} | ${1}
        ${laterNested} | ${'a.b.e'} | ${5}
        ${laterDotted} | ${'a.b.c'} | ${1}
        ${laterDotted} | ${'a.b.d'} | ${1}
        ${laterDotted} | ${'a.b.e'} | ${undefined}
        ${laterDotted} | ${'a.b'}   | ${undefined}
    `('$name in $values is $expected', ({ values, name, expected }) => {
        expect(resolveValue(values, name)).toBe(expected);
    });

    test('a nested key with a dot never matches', () => {
        expect(resolveValue({ a: { 'b.c': 1 } }, 'a.b.c')).toBeUndefined();
    });

    test('only own properties count', () => {
        expect(resolveValue({}, 'toString')).toBeUndefined();
        expect(resolveValue({ a: {} }, 'a.constructor')).toBeUndefined();
    });
});

describe('template kinds', () => {
    test('a single paragraph is inline', () => {
        const md = template('Hello {@ name @}', { name: 'you' });
        expect(md.kind).toBe('inline');
        // The kind narrows the result to the inline template.
        if (md.kind === 'inline') expect(heading(2, md).toString()).toBe('## Hello you');
    });

    test('a lone placeholder takes its kind from its value', () => {
        expect(template('{@ x @}', { x: 'hi' }).kind).toBe('inline');
        expect(template('{@ x @}', { x: list(['a']) }).kind).toBe('block');
    });

    test('anything else is blocks', () => {
        expect(template('- a', {}).kind).toBe('block');
        expect(template('a\n\nb', {}).kind).toBe('block');
        expect(template('    code', {}).kind).toBe('block');
    });

    test('an inline result drops the surrounding whitespace', () => {
        expect(template('\n  Hello  \n', {}).toString()).toBe('Hello');
    });

    test('blockTemplate keeps a single paragraph as a block', () => {
        const md = blockTemplate('Hello {@ name @}', { name: 'you' });
        expect(md.kind).toBe('block');
        expect(document(md).toString()).toBe('Hello you\n');
    });
});

describe('template', () => {
    test('a string is inserted as text and escaped', () => {
        expect(template('Hello {@ name @}!', { name: '*you*' }).toString()).toBe('Hello \\*you\\*!');
    });

    test('an inline value goes inside a line', () => {
        const md = template('See {@ docs @}.', { docs: link('the docs', 'https://example.com') });
        expect(md.toString()).toBe('See [the docs](https://example.com).');
    });

    test('a placeholder alone in its paragraph takes blocks', () => {
        const md = template('## Dictionaries\n\n{@ list @}\n\nEnd.\n', { list: list(['en', 'de']) });
        expect(md.toString()).toBe('## Dictionaries\n\n- en\n- de\n\nEnd.');
    });

    test('a block inside a line throws', () => {
        expect(() => template('See {@ list @}.', { list: list(['en']) })).toThrow(
            new TypeError('{@ list @} must be inline, got a list'),
        );
    });

    test('a placeholder inside code is replaced as is', () => {
        const tpl = '```sh\nnpm install -D {@ pkg @}\n```\n\nVersion `{@ engines.cspell @}`\n';
        const md = template(tpl, { pkg: '@cspell/dict-*', 'engines.cspell': '>=8' });
        expect(md.toString()).toBe('```sh\nnpm install -D @cspell/dict-*\n```\n\nVersion `>=8`');
    });

    test('code takes only a string or text', () => {
        expect(() => template('`{@ x @}`', { x: link('a', 'b') })).toThrow(
            new TypeError('{@ x @} is inside code and takes only a string or text, got a link'),
        );
        expect(template('`{@ x @}`', { x: text('a*b') }).toString()).toBe('`a*b`');
    });

    test.each`
        values
        ${{ engines: { cspell: placeholder('engines.cspell') } }}
        ${{ 'engines.cspell': placeholder('engines.cspell') }}
        ${{ 'engines.cspell': '{@ engines.cspell @}' }}
    `('a placeholder kept for injection time: $values', ({ values }) => {
        const md = template('cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}', values);
        expect(md.toString()).toBe('cspell `{@ engines.cspell @}`, needs {@ engines.cspell @}');
    });

    test('a placeholder with no value throws, naming every missing one', () => {
        expect(() => template('{@ a @} {@ b.c @} {@ a @} {@ d @}', { d: 'x' })).toThrow(
            'template has no value for {@ a @}, {@ b.c @}',
        );
    });

    test('an escaped placeholder in code stays literal', () => {
        expect(template('`\\{@ x @}`', {}).toString()).toBe('`{@ x @}`');
    });

    test('the template keeps its own style', () => {
        const md = template('* {@ a @}\n* *b*\n', { a: 'one' });
        expect(md.toString()).toBe('* one\n* *b*');
    });

    test('numbers and booleans are text', () => {
        expect(template('{@ n @} {@ b @}', { n: 1, b: true }).toString()).toBe('1 true');
    });
});

describe('inlineTemplate', () => {
    test('a fragment inside a list item', () => {
        const e = { name: 'German', url: '../de.md' };
        const md = list([listItem(link(e.name, e.url), inlineTemplate(' - Adds {@ name @} spell checking', e))]);
        expect(md.toString()).toBe('- [German](../de.md) - Adds German spell checking');
    });

    test('block syntax is read as text', () => {
        expect(inlineTemplate('# not a heading', {}).toString()).toBe('\\# not a heading');
    });

    test('more than one paragraph throws', () => {
        expect(() => inlineTemplate('a\n\nb', {})).toThrow('inline template text must be one paragraph');
    });

    test('a block value throws', () => {
        expect(() => inlineTemplate('{@ x @}', { x: codeBlock('x') })).toThrow(TypeError);
    });

    test('inline values fit', () => {
        expect(inlineTemplate('use {@ x @}', { x: inlineCode('cspell') }).toString()).toBe('use `cspell`');
    });
});

describe('parse', () => {
    test('a single paragraph is inline', () => {
        const md = parse('  Hello *you*\n');
        if (md.kind !== 'inline') throw new Error('expected inline');
        expect(md.toString()).toBe('Hello *you*');
        expect(link(md, 'https://example.com').toString()).toBe('[Hello _you_](https://example.com)');
    });

    test('anything else is blocks', () => {
        const md = parse('# Title\n\nSome text.\n');
        if (md.kind !== 'block') throw new Error('expected blocks');
        expect(document(md).toString()).toBe('# Title\n\nSome text.\n');
    });

    test('the text keeps its own style', () => {
        expect(parse('* a\n* b\n').toString()).toBe('* a\n* b');
    });

    test('inside a document, the document style wins', () => {
        expect(document(toBlock(parse('* a\n* b\n'))).toString()).toBe('- a\n- b\n');
    });

    test.each`
        markdown             | expected
        ${'See {@ pkg @}'}   | ${'See {@ pkg @}'}
        ${'{@ _x_ @}'}       | ${'{@ _x_ @}'}
        ${'`{@ x @}`'}       | ${'`{@ x @}`'}
        ${'a \\\\{@ x @} b'} | ${'a \\\\{@ x @} b'}
    `(
        'placeholders are kept as written: $markdown',
        ({ markdown, expected }: { markdown: string; expected: string }) => {
            expect(parse(markdown).toString()).toBe(expected);
        },
    );
});

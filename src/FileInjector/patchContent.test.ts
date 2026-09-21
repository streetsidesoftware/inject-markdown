import type { Html, RootContent } from 'mdast';
import { describe, expect, test } from 'vitest';

import { applyPatches, type Patch, stringifyFragment } from './patchContent.js';

describe('applyPatches', () => {
    test('leaves content unchanged when there are no patches', () => {
        const content = 'before\nunchanged\nafter\n';
        expect(applyPatches(content, [])).toBe(content);
    });

    test('splices a single patch in, leaving the rest untouched', () => {
        const content = 'before <old> after';
        const patches: Patch[] = [{ start: 'before '.length, end: 'before <old>'.length, text: '<new>' }];
        expect(applyPatches(content, patches)).toBe('before <new> after');
    });

    test('applies multiple non-overlapping patches in document order', () => {
        const content = '[A][B][C]';
        const patches: Patch[] = [
            { start: 0, end: 3, text: '[a]' },
            { start: 6, end: 9, text: '[c]' },
        ];
        expect(applyPatches(content, patches)).toBe('[a][B][c]');
    });

    test('an empty replacement text deletes the span (used by --clean)', () => {
        const content = '<!--- start ---><!--- body ---><!--- end --->';
        const patches: Patch[] = [{ start: '<!--- start --->'.length, end: content.length, text: '' }];
        expect(applyPatches(content, patches)).toBe('<!--- start --->');
    });
});

describe('stringifyFragment', () => {
    const outputOptions = {
        bullet: '-' as const,
        emphasis: '_' as const,
        fence: '`' as const,
        fences: true,
        incrementListMarker: false,
        rule: '-' as const,
        strong: '*' as const,
    };

    test('strips the trailing newline(s) remark-stringify appends for a root', () => {
        const nodes: RootContent[] = [{ type: 'paragraph', children: [{ type: 'text', value: 'hello' }] }];
        expect(stringifyFragment(nodes, outputOptions, '\n')).toBe('hello');
    });

    test('joins an html comment and a paragraph with the expected blank line', () => {
        const start: Html = { type: 'html', value: '<!--- @@inject: file.md --->' };
        const paragraph: RootContent = { type: 'paragraph', children: [{ type: 'text', value: 'Injected.' }] };
        const end: Html = { type: 'html', value: '<!--- @@inject-end: file.md --->' };
        expect(stringifyFragment([start, paragraph, end], outputOptions, '\n')).toBe(
            '<!--- @@inject: file.md --->\n\nInjected.\n\n<!--- @@inject-end: file.md --->',
        );
    });

    test('converts newlines to the given line ending', () => {
        const nodes: RootContent[] = [
            { type: 'paragraph', children: [{ type: 'text', value: 'one' }] },
            { type: 'paragraph', children: [{ type: 'text', value: 'two' }] },
        ];
        expect(stringifyFragment(nodes, outputOptions, '\r\n')).toBe('one\r\n\r\ntwo');
    });

    test('stringifies a GFM table fragment', () => {
        const table: RootContent = {
            type: 'table',
            align: [null, null],
            children: [
                {
                    type: 'tableRow',
                    children: [
                        { type: 'tableCell', children: [{ type: 'text', value: 'a' }] },
                        { type: 'tableCell', children: [{ type: 'text', value: 'b' }] },
                    ],
                },
            ],
        };
        expect(stringifyFragment([table], outputOptions, '\n')).toBe('| a | b |\n| - | - |');
    });
});

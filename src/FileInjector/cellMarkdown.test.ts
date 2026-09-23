import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { parseCellMarkdown } from './cellMarkdown.js';
import { rowsToTable } from './Table.js';

/** Render a one-column table body cell to its Markdown row, e.g. `| x |`. */
function renderCell(value: string): string {
    const table = rowsToTable([['h'], [value]], { markdown: true });
    const root: Root = { type: 'root', children: [table] };
    const out = unified().use(remarkGfm).use(remarkStringify).stringify(root);
    return out.split('\n')[2].replace(/^\| (.*?) *\|$/, '$1');
}

/** Number of cells in the body row after rendering and re-parsing the table. */
function cellCountAfterRoundTrip(value: string): number {
    const table = rowsToTable([['h'], [value]], { markdown: true });
    const out = unified()
        .use(remarkGfm)
        .use(remarkStringify)
        .stringify({ type: 'root', children: [table] });
    const back = unified().use(remarkParse).use(remarkGfm).parse(out);
    const parsed = back.children[0];
    if (parsed.type !== 'table') throw new Error('expected a table');
    return parsed.children[1].children.length;
}

describe('parseCellMarkdown', () => {
    test('parses inline constructs', () => {
        const types = parseCellMarkdown('**b** _i_ `c` [l](u) ~~s~~ <sup>1</sup>').map((n) => n.type);
        expect(types).toEqual(expect.arrayContaining(['strong', 'emphasis', 'inlineCode', 'link', 'delete', 'html']));
    });

    // Block syntax renders literally (ADR-0008 point 5); newlines become `<br />` (point 7).
    test.each`
        value             | expected
        ${'a\nb'}         | ${'a<br />b'}
        ${'a\r\nb'}       | ${'a<br />b'}
        ${'# Title'}      | ${'# Title'}
        ${'1. first'}     | ${'1. first'}
        ${'> note'}       | ${'> note'}
        ${'---'}          | ${'---'}
        ${'```js'}        | ${'\\`\\`\\`js'}
        ${'[a]: /url'}    | ${'\\[a]: /url'}
        ${'<div>x</div>'} | ${'<div>x</div>'}
        ${'- item **b**'} | ${'- item **b**'}
        ${'**a|b**'}      | ${'**a\\|b**'}
        ${'`a|b`'}        | ${'`a\\|b`'}
        ${'<b>|</b>'}     | ${'<b>\\|</b>'}
    `('renders $value as $expected', ({ value, expected }) => {
        expect(renderCell(value)).toBe(expected);
    });

    test.each([
        'a | b',
        '`a|b`',
        '<a title="x|y">z</a>',
        'https://a.b/c|d',
        '<https://a.b/c|d>',
        '[x](u|v)',
        '![i|j](p|q.png)',
    ])('a pipe never splits the cell: %s', (value) => {
        expect(cellCountAfterRoundTrip(value)).toBe(1);
    });
});

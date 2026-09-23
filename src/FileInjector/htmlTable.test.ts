import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { rowsToHtmlTable } from './Table.js';

function render(rows: string[][]): string {
    return unified()
        .use(remarkGfm)
        .use(remarkStringify)
        .stringify({ type: 'root', children: rowsToHtmlTable(rows) });
}

describe('rowsToHtmlTable (ADR-0010)', () => {
    test('plain cells stay on one line with HTML-escaped text', () => {
        expect(
            render([
                ['h1', 'h2'],
                ['a < b & c', ''],
            ]),
        ).toBe(
            [
                '<table>',
                '<thead>',
                '<tr>',
                '<th>h1</th>',
                '<th>h2</th>',
                '</tr>',
                '</thead>',
                '<tbody>',
                '<tr>',
                '<td>a &lt; b &amp; c</td>',
                '<td></td>',
                '</tr>',
                '</tbody>',
                '</table>',
                '',
            ].join('\n'),
        );
    });

    test('cells with markup are wrapped in blank lines at column 0, blocks included', () => {
        const out = render([['h'], ['**new**\n\n- a\n- b']]);
        // remark-stringify's default bullet here; FileInjector uses the document's detected style.
        expect(out).toContain('<td>\n\n**new**\n\n* a\n* b\n\n</td>');
    });

    test('a header cell with markup is wrapped too', () => {
        expect(render([['**h**']])).toContain('<th>\n\n**h**\n\n</th>');
    });

    test('a single newline is a soft wrap, so the cell is wrapped rather than compact', () => {
        expect(render([['h'], ['one\ntwo']])).toContain('<td>\n\none\ntwo\n\n</td>');
    });

    test('a pipe is emitted as-is', () => {
        expect(render([['h'], ['a | b']])).toContain('<td>a | b</td>');
    });

    test('ragged rows are padded with empty cells', () => {
        expect(render([['a', 'b'], ['1']])).toContain('<td>1</td>\n<td></td>');
    });
});

import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { type CellValue, type ColumnOptions, type HeaderRowsOption, rowsToHtmlTable } from './Table.js';

function render(rows: CellValue[][]): string {
    return unified()
        .use(remarkGfm)
        .use(remarkStringify)
        .stringify({ type: 'root', children: rowsToHtmlTable(rows) });
}

function render2(rows: CellValue[][], headerRows: number): string {
    return unified()
        .use(remarkGfm)
        .use(remarkStringify)
        .stringify({ type: 'root', children: rowsToHtmlTable(rows, { headerRows }) });
}

function renderWith(rows: CellValue[][], options: HeaderRowsOption & ColumnOptions): string {
    return unified()
        .use(remarkGfm)
        .use(remarkStringify)
        .stringify({ type: 'root', children: rowsToHtmlTable(rows, options) });
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

    // ADR-0010 point 12: a definition must not apply to the rest of the document.
    test.each`
        value                                     | expected
        ${'[a]: https://x.y'}                     | ${'<td>[a]: https://x.y</td>'}
        ${'**b**\n\n[a]: https://x.y'}            | ${'\n\\[a]: https\\://x.y\n'}
        ${'> [a]: https://x.y'}                   | ${'> \\[a]: https\\://x.y'}
        ${'- [a]: https://x.y'}                   | ${'* \\[a]: https\\://x.y'}
        ${'text[^1]\n\n[^1]: the note\n    more'} | ${'\\[^1]: the note\nmore'}
    `('a definition stays in its cell as literal text: $value', ({ value, expected }) => {
        const out = render([['h'], [value]]);
        expect(out).toContain(expected);
        expect(out).not.toMatch(/^\[a\]:/m);
        expect(out).not.toMatch(/^\[\^1\]:/m);
    });

    test('a nested JSON value becomes a pretty-printed json code block (ADR-0011)', () => {
        expect(render([['h'], [{ json: { x: [1] } }]])).toContain(
            '<td>\n\n```json\n{\n  "x": [\n    1\n  ]\n}\n```\n\n</td>',
        );
    });

    test('header-rows=2 gives two header rows (ADR-0010 point 4)', () => {
        const out = render2([['a'], ['b'], ['c']], 2);
        expect(out).toContain('<thead>\n<tr>\n<th>a</th>\n</tr>\n<tr>\n<th>b</th>\n</tr>\n</thead>');
        expect(out).toContain('<td>c</td>');
    });

    test('header-rows=0 has no <thead>', () => {
        const out = render2([['a'], ['b']], 0);
        expect(out).not.toContain('<thead>');
        expect(out).toContain('<tbody>\n<tr>\n<td>a</td>');
    });

    test('columns select and order cells, with alignment as an attribute on every cell', () => {
        const out = renderWith(
            [
                ['a', 'b'],
                ['1', '2'],
            ],
            {
                columns: [
                    { index: 1, align: 'right' },
                    { index: 0, align: null },
                ],
            },
        );
        expect(out).toContain('<tr>\n<th align="right">b</th>\n<th>a</th>\n</tr>');
        expect(out).toContain('<tr>\n<td align="right">2</td>\n<td>1</td>\n</tr>');
    });

    test('header-format applies to header cells only; a column-names label is verbatim', () => {
        const out = renderWith(
            [
                ['a b', '*c*'],
                ['x y', 'z'],
            ],
            {
                headerFormat: 'upper',
                columns: [
                    { index: 0, align: null },
                    { index: 1, align: null, label: 'iPhone' },
                ],
            },
        );
        expect(out).toContain('<th>A B</th>\n<th>iPhone</th>');
        expect(out).toContain('<td>x y</td>');
    });

    test('a label goes in the last header row; rows above leave that column blank', () => {
        const out = renderWith(
            [
                ['g', 'g'],
                ['a', 'b'],
                ['1', '2'],
            ],
            {
                headerRows: 2,
                columns: [
                    { index: 0, align: null, label: 'X' },
                    { index: 1, align: null },
                ],
            },
        );
        expect(out).toContain('<thead>\n<tr>\n<th></th>\n<th>g</th>\n</tr>\n<tr>\n<th>X</th>\n<th>b</th>\n</tr>');
    });

    test('with header-rows=0, column-names adds a header row', () => {
        const out = renderWith([['1', '2']], {
            headerRows: 0,
            columns: [
                { index: 0, align: null, label: 'A' },
                { index: 1, align: null },
            ],
        });
        expect(out).toContain('<thead>\n<tr>\n<th>A</th>\n<th></th>\n</tr>\n</thead>');
        expect(render2([['1', '2']], 0)).not.toContain('<thead>');
    });
});

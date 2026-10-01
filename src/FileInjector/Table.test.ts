import { describe, expect, test } from 'vitest';

import { isJsonCell, rowsToTable } from './Table.js';

describe('rowsToTable', () => {
    test('builds a header row and body rows', () => {
        const table = rowsToTable([
            ['name', 'age'],
            ['Alice', '30'],
        ]);
        expect(table).toEqual({
            type: 'table',
            align: [null, null],
            children: [
                {
                    type: 'tableRow',
                    children: [
                        { type: 'tableCell', children: [{ type: 'text', value: 'name' }] },
                        { type: 'tableCell', children: [{ type: 'text', value: 'age' }] },
                    ],
                },
                {
                    type: 'tableRow',
                    children: [
                        { type: 'tableCell', children: [{ type: 'text', value: 'Alice' }] },
                        { type: 'tableCell', children: [{ type: 'text', value: '30' }] },
                    ],
                },
            ],
        });
    });

    test('pads ragged rows to the widest row', () => {
        const table = rowsToTable([['a', 'b', 'c'], ['1']]);
        expect(table.children[1]).toEqual({
            type: 'tableRow',
            children: [
                { type: 'tableCell', children: [{ type: 'text', value: '1' }] },
                { type: 'tableCell', children: [] },
                { type: 'tableCell', children: [] },
            ],
        });
    });

    test('markdown: parses cells as inline Markdown', () => {
        const table = rowsToTable([['**h**'], ['a']], { markdown: true });
        expect(table.children[0].children[0]).toEqual({
            type: 'tableCell',
            children: [{ type: 'strong', children: [expect.objectContaining({ type: 'text', value: 'h' })] }].map((n) =>
                expect.objectContaining(n),
            ),
        });
    });

    test('without markdown, cells stay literal text', () => {
        const table = rowsToTable([['**h**']]);
        expect(table.children[0].children[0]).toEqual({
            type: 'tableCell',
            children: [{ type: 'text', value: '**h**' }],
        });
    });

    test('a nested JSON value is compact text, or a code span with markdown (ADR-0011)', () => {
        const rows = [['h'], [{ json: { x: 1 } }]];
        expect(rowsToTable(rows).children[1].children[0].children).toEqual([{ type: 'text', value: '{"x":1}' }]);
        expect(rowsToTable(rows, { markdown: true }).children[1].children[0].children).toEqual([
            { type: 'inlineCode', value: '{"x":1}' },
        ]);
    });

    describe('header-rows (ADR-0002)', () => {
        const texts = (table: ReturnType<typeof rowsToTable>) =>
            table.children[0].children.map((c) => c.children.map((n) => ('value' in n ? n.value : '')).join(''));

        test('joins header rows per column with <br />, skipping blank cells', () => {
            const table = rowsToTable(
                [
                    ['Date', 'Name', 'Name'],
                    ['', 'First', 'Last'],
                    ['d', 'Ada', 'L'],
                ],
                { headerRows: 2 },
            );
            expect(texts(table)).toEqual(['Date', 'Name<br />First', 'Name<br />Last']);
            expect(table.children).toHaveLength(2);
        });

        test('header-rows=0 numbers the columns and keeps every row as data', () => {
            const table = rowsToTable([['a', 'b'], ['c']], { headerRows: 0 });
            expect(texts(table)).toEqual(['1', '2']);
            expect(table.children).toHaveLength(3);
        });

        test('with markdown, each header part is parsed', () => {
            const table = rowsToTable([['**a**'], ['b']], { headerRows: 2, markdown: true });
            expect(table.children[0].children[0].children.map((n) => n.type)).toEqual(['strong', 'html', 'text']);
        });
    });

    test.each([null, { x: 1 }, ['a'], 'text', undefined])('isJsonCell(%j) is false', (value) => {
        expect(isJsonCell(value)).toBe(false);
    });

    test('isJsonCell({ json }) is true', () => {
        expect(isJsonCell({ json: { x: 1 } })).toBe(true);
    });

    describe('columns (ADR-0003, ADR-0006, ADR-0007)', () => {
        const rows = [
            ['unit price', 'qty'],
            ['$1', '2'],
        ];

        function header(table: ReturnType<typeof rowsToTable>): string[] {
            return table.children[0].children.map((c) => c.children.map((n) => ('value' in n ? n.value : '')).join(''));
        }

        test('selects, reorders and aligns', () => {
            const table = rowsToTable(rows, {
                columns: [
                    { index: 1, align: 'right' },
                    { index: 0, align: 'center' },
                ],
            });
            expect(table.align).toEqual(['right', 'center']);
            expect(header(table)).toEqual(['qty', 'unit price']);
            expect(table.children[1].children[0].children).toEqual([{ type: 'text', value: '2' }]);
        });

        test('header-format formats each header part; a label is verbatim', () => {
            const table = rowsToTable(
                [
                    ['unit price', 'qty'],
                    ['each', ''],
                    ['1', '2'],
                ],
                {
                    headerRows: 2,
                    headerFormat: 'title',
                    columns: [
                        { index: 0, align: null },
                        { index: 1, align: null, label: 'iPhone sales' },
                    ],
                },
            );
            expect(header(table)).toEqual(['Unit Price<br />Each', 'iPhone sales']);
        });

        test('header-rows=0 numbers by source column; a label replaces the number', () => {
            const table = rowsToTable([['a', 'b', 'c']], {
                headerRows: 0,
                columns: [
                    { index: 2, align: null },
                    { index: 0, align: null, label: 'First' },
                ],
            });
            expect(header(table)).toEqual(['3', 'First']);
        });
    });
});

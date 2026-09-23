import { describe, expect, test } from 'vitest';

import { rowsToTable } from './Table.js';

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
});

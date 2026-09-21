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
});

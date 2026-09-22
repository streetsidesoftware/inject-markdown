import type { Table } from 'mdast';
import { describe, expect, test } from 'vitest';

import { isNumericLike, parseTableOptions, rowsToTable } from './Table.js';

/** Render a table's cells as plain strings, `<br />` html nodes included. */
function cellText(table: Table): string[][] {
    return table.children.map((row) =>
        row.children.map((cell) => cell.children.map((c) => ('value' in c ? c.value : '')).join('')),
    );
}

const sample = [
    ['Name', 'Unit  Price', 'Qty', 'Notes'],
    ['apple', '$1.20', '3', 'red'],
    ['pear', '$0.90', '10', 'green'],
    ['fig', 'N/A', '7', ''],
];

describe('rowsToTable', () => {
    test('builds a header row and body rows', () => {
        const table = rowsToTable([
            ['name', 'age'],
            ['Alice', '30'],
        ]);
        expect(table).toEqual({
            type: 'table',
            align: [null, 'right'],
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

describe('parseTableOptions', () => {
    test('defaults', () => {
        expect(parseTableOptions(undefined)).toEqual({
            headerRows: 1,
            startRow: 1,
            numRows: 10000,
            headerFormat: 'none',
        });
    });

    test.each`
        raw                                            | expected
        ${{ 'header-rows': '' }}                       | ${{ headerRows: 1 }}
        ${{ 'header-rows': '0' }}                      | ${{ headerRows: 0 }}
        ${{ 'header-rows': '2' }}                      | ${{ headerRows: 2 }}
        ${{ 'start-row': '5', 'num-rows': '0' }}       | ${{ startRow: 5, numRows: 0 }}
        ${{ 'end-row': '3' }}                          | ${{ endRow: 3 }}
        ${{ 'header-format': 'title' }}                | ${{ headerFormat: 'title' }}
        ${{ 'column-names': '",,Return Date,Value"' }} | ${{ columnNames: ['', '', 'Return Date', 'Value'] }}
        ${{ columns: 'Name,Age:,:Notes,:Mid:,3' }}     | ${{ columns: [{ ref: 'Name', align: undefined }, { ref: 'Age', align: 'right' }, { ref: 'Notes', align: 'left' }, { ref: 'Mid', align: 'center' }, { ref: 3, align: undefined }] }}
        ${{ columns: '"First  Name,Age"' }}            | ${{ columns: [{ ref: 'First Name', align: undefined }, { ref: 'Age', align: undefined }] }}
    `('parse $raw', ({ raw, expected }) => {
        expect(parseTableOptions(raw)).toEqual(expect.objectContaining(expected));
    });

    test.each`
        raw
        ${{ columns: '' }}
        ${{ columns: 'a,,b' }}
        ${{ 'num-rows': '' }}
        ${{ 'num-rows': '-1' }}
        ${{ 'start-row': '0' }}
        ${{ 'header-rows': 'x' }}
        ${{ 'header-format': 'camel' }}
    `('reject $raw', ({ raw }) => {
        expect(() => parseTableOptions(raw)).toThrow();
    });
});

describe('rowsToTable options', () => {
    test('auto-aligns numeric and currency columns, tolerating a few non-numeric values', () => {
        const rows = [['n'], ...Array.from({ length: 9 }, (_, i) => [`$${i},000.5`]), ['N/A']];
        expect(rowsToTable(rows).align).toEqual(['right']);
        expect(rowsToTable(sample).align).toEqual([null, null, 'right', null]);
    });

    test('columns selects, reorders, duplicates, and aligns', () => {
        const table = rowsToTable(sample, parseTableOptions({ columns: '"Qty,:Unit Price:,1,Name:"' }));
        expect(table.align).toEqual(['right', 'center', null, 'right']);
        expect(cellText(table)[0]).toEqual(['Qty', 'Unit  Price', 'Name', 'Name']);
        expect(cellText(table)[1]).toEqual(['3', '$1.20', 'apple', 'apple']);
    });

    test('explicit left alignment overrides auto-alignment', () => {
        expect(rowsToTable(sample, parseTableOptions({ columns: ':Qty' })).align).toEqual(['left']);
    });

    test.each`
        raw                                        | message
        ${{ columns: '5' }}                        | ${'out of range'}
        ${{ columns: 'Price' }}                    | ${'not found'}
        ${{ columns: 'name' }}                     | ${'not found'}
        ${{ columns: 'Name', 'header-rows': '0' }} | ${'by number'}
    `('bad column reference $raw', ({ raw, message }) => {
        expect(() => rowsToTable(sample, parseTableOptions(raw))).toThrow(message);
    });

    test('header-rows=0 numbers the header and keeps every row as data', () => {
        const table = rowsToTable(sample, parseTableOptions({ 'header-rows': '0', columns: '3,1' }));
        expect(cellText(table).slice(0, 2)).toEqual([
            ['3', '1'],
            ['Qty', 'Name'],
        ]);
    });

    test('multi-row headers join for display with <br /> and for matching with a space', () => {
        const rows = [
            ['Date', 'Name', 'Name', 'Value'],
            ['', 'First', 'Last', ''],
            ['2026-01-01', 'Ada', 'Lovelace', '1'],
        ];
        const table = rowsToTable(
            rows,
            parseTableOptions({ 'header-rows': '2', columns: '"Name Last,Name First,Date"', 'header-format': 'upper' }),
        );
        expect(cellText(table)).toEqual([
            ['NAME<br />LAST', 'NAME<br />FIRST', 'DATE'],
            ['Lovelace', 'Ada', '2026-01-01'],
        ]);
        expect(table.children[0].children[0].children.map((c) => c.type)).toEqual(['text', 'html', 'text']);
    });

    test.each`
        raw                                                      | expected
        ${{}}                                                    | ${['apple', 'pear', 'fig']}
        ${{ 'start-row': '2' }}                                  | ${['pear', 'fig']}
        ${{ 'num-rows': '2' }}                                   | ${['apple', 'pear']}
        ${{ 'start-row': '2', 'end-row': '2' }}                  | ${['pear']}
        ${{ 'start-row': '1', 'num-rows': '2', 'end-row': '3' }} | ${['apple', 'pear']}
        ${{ 'start-row': '9' }}                                  | ${[]}
        ${{ 'start-row': '3', 'end-row': '2' }}                  | ${[]}
    `('row window $raw', ({ raw, expected }) => {
        const table = rowsToTable(sample, parseTableOptions(raw));
        expect(
            cellText(table)
                .slice(1)
                .map((r) => r[0]),
        ).toEqual(expected);
    });

    test.each`
        format     | expected
        ${'none'}  | ${'unit_price NAME'}
        ${'title'} | ${'Unit_price Name'}
        ${'upper'} | ${'UNIT_PRICE NAME'}
        ${'lower'} | ${'unit_price name'}
    `('header-format=$format', ({ format, expected }) => {
        const table = rowsToTable([['unit_price NAME']], parseTableOptions({ 'header-format': format }));
        expect(cellText(table)[0]).toEqual([expected]);
    });

    test('column-names overrides output headers verbatim, bypassing header-format', () => {
        const table = rowsToTable(
            sample,
            parseTableOptions({ columns: 'Qty,Name,Notes', 'column-names': ',iPhone Sales', 'header-format': 'upper' }),
        );
        expect(cellText(table)[0]).toEqual(['QTY', 'iPhone Sales', 'NOTES']);
        const extra = rowsToTable(sample, parseTableOptions({ 'column-names': 'a,b,c,d,e,f' }));
        expect(cellText(extra)[0]).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('isNumericLike', () => {
    test.each`
        value          | expected
        ${'42'}        | ${true}
        ${'-1,234.56'} | ${true}
        ${'1.234,56'}  | ${true}
        ${'+€5'}       | ${true}
        ${'£1,000'}    | ${true}
        ${'¥300'}      | ${true}
        ${'12.5%'}     | ${true}
        ${'USD 5'}     | ${false}
        ${'₹5'}        | ${false}
        ${'5kg'}       | ${false}
        ${'1,23,4'}    | ${false}
        ${'N/A'}       | ${false}
    `('$value', ({ value, expected }) => {
        expect(isNumericLike(value)).toBe(expected);
    });
});

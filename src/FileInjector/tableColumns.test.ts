import type { Nodes } from 'mdast';
import { describe, expect, test } from 'vitest';

import { parseCellBlocks, parseCellMarkdown } from './cellMarkdown.js';
import {
    cellPlainText,
    formatHeaderNodes,
    formatHeaderText,
    isNumericLike,
    layoutColumns,
    parseColumnNamesOption,
    parseColumnsOption,
    resolveHeaderFormat,
} from './tableColumns.js';

const sample = [
    ['Name', 'Unit  Price', 'Qty', 'Notes'],
    ['apple', '$1.20', '3', 'red'],
    ['pear', '$0.90', '10', 'green'],
    ['fig', 'N/A', '7', ''],
];

const base = { headerRows: 1, columnCount: 4, form: 'text' } as const;

describe('parseColumnsOption', () => {
    test.each`
        value                       | expected
        ${'Name,Age:,:Notes,:Mid:'} | ${[{ ref: 'Name', align: undefined }, { ref: 'Age', align: 'right' }, { ref: 'Notes', align: 'left' }, { ref: 'Mid', align: 'center' }]}
        ${'3,1'}                    | ${[{ ref: 3, align: undefined }, { ref: 1, align: undefined }]}
        ${'"First  Name,Age"'}      | ${[{ ref: 'First Name', align: undefined }, { ref: 'Age', align: undefined }]}
    `('$value', ({ value, expected }) => {
        expect(parseColumnsOption(value)).toEqual(expected);
    });

    test.each(['', 'a,,b', ':'])('rejects %j', (value) => {
        expect(() => parseColumnsOption(value)).toThrow('Invalid columns');
    });
});

describe('parseColumnNamesOption', () => {
    test('quoted list keeps empty entries', () => {
        expect(parseColumnNamesOption('",,Return Date,Value"')).toEqual(['', '', 'Return Date', 'Value']);
    });

    test('rejects an empty value', () => {
        expect(() => parseColumnNamesOption('')).toThrow('Invalid column-names');
    });
});

describe('resolveHeaderFormat', () => {
    test.each(['none', 'title', 'upper', 'lower'])('%s', (v) => expect(resolveHeaderFormat(v)).toBe(v));
    test('default', () => expect(resolveHeaderFormat(undefined)).toBe('none'));
    test.each(['', 'camel'])('rejects %j', (v) => expect(() => resolveHeaderFormat(v)).toThrow('header-format'));
});

describe('layoutColumns', () => {
    test('defaults to every column, auto-aligned', () => {
        expect(layoutColumns(sample, base)).toEqual([
            { index: 0, align: null, label: undefined },
            // 2 of 3 values are currency: below the 90% threshold.
            { index: 1, align: null, label: undefined },
            { index: 2, align: 'right', label: undefined },
            { index: 3, align: null, label: undefined },
        ]);
    });

    test('selects, reorders, duplicates, and applies markers over auto-alignment', () => {
        const cols = layoutColumns(sample, { ...base, columns: '"Qty,:Unit Price:,1,Name:,:Qty"' });
        expect(cols.map((c) => [c.index, c.align])).toEqual([
            [2, 'right'],
            [1, 'center'],
            [0, null],
            [0, 'right'],
            [2, 'left'],
        ]);
    });

    test('column-names are positional against the output, empty keeps, extras ignored', () => {
        const cols = layoutColumns(sample, { ...base, columns: 'Qty,Name', columnNames: ',Fruit,Extra' });
        expect(cols.map((c) => c.label)).toEqual([undefined, 'Fruit']);
    });

    test.each`
        options                               | message
        ${{ columns: '5' }}                   | ${'out of range'}
        ${{ columns: '0' }}                   | ${'out of range'}
        ${{ columns: 'Price' }}               | ${'not found'}
        ${{ columns: 'name' }}                | ${'not found'}
        ${{ columns: 'Name', headerRows: 0 }} | ${'by number'}
    `('bad reference $options', ({ options, message }) => {
        expect(() => layoutColumns(sample, { ...base, ...options })).toThrow(message);
    });

    test('names match the space-joined, non-empty cells of every header row', () => {
        const rows = [
            ['Date', 'Name', 'Name', 'Value'],
            ['', 'First', 'Last', ''],
            ['2026-01-01', 'Ada', 'Lovelace', '1'],
        ];
        const cols = layoutColumns(rows, { ...base, headerRows: 2, columns: '"Name Last,Date,Value"' });
        expect(cols.map((c) => c.index)).toEqual([2, 0, 3]);
    });

    test('markdown cells match and auto-align on plain text (ADR-0009)', () => {
        const rows = [
            ['**Price**', '`id`'],
            ['**$5.00**', '`42`'],
        ];
        const cols = layoutColumns(rows, { ...base, columnCount: 2, form: 'markdown', columns: 'id,Price' });
        expect(cols.map((c) => [c.index, c.align])).toEqual([
            [1, 'right'],
            [0, 'right'],
        ]);
        expect(() => layoutColumns(rows, { ...base, columnCount: 2, columns: 'Price' })).toThrow('not found');
    });

    test('auto-alignment tolerates up to 10% non-numeric values and ignores empty cells', () => {
        const rows = [['n'], ...Array.from({ length: 9 }, (_, i) => [`${i},000.5`]), ['N/A'], ['']];
        expect(layoutColumns(rows, { ...base, columnCount: 1 })[0].align).toBe('right');
        expect(layoutColumns([['n'], ['']], { ...base, columnCount: 1 })[0].align).toBe(null);
    });
});

describe('cellPlainText', () => {
    test.each`
        value                               | form          | expected
        ${'**a**'}                          | ${'text'}     | ${'**a**'}
        ${'**a**<br />`b`'}                 | ${'markdown'} | ${'a b'}
        ${'[link](http://x) ![alt](i.png)'} | ${'markdown'} | ${'link alt'}
        ${'<sup>1</sup>x'}                  | ${'markdown'} | ${'1x'}
        ${'- a\n- b'}                       | ${'html'}     | ${'a b'}
        ${'p1\n\np2'}                       | ${'html'}     | ${'p1 p2'}
    `('$value ($form)', ({ value, form, expected }) => {
        expect(cellPlainText(value, form)).toBe(expected);
    });

    test('JSON cells are compact JSON', () => {
        expect(cellPlainText({ json: { x: 1 } }, 'text')).toBe('{"x":1}');
    });
});

describe('header-format', () => {
    test.each`
        format     | expected
        ${'none'}  | ${'unit_price NAME'}
        ${'title'} | ${'Unit_price Name'}
        ${'upper'} | ${'UNIT_PRICE NAME'}
        ${'lower'} | ${'unit_price name'}
    `('formatHeaderText $format', ({ format, expected }) => {
        expect(formatHeaderText('unit_price NAME', format)).toBe(expected);
    });

    function formatted(nodes: Nodes[], format: 'title' | 'upper'): Nodes[] {
        formatHeaderNodes(nodes, format);
        return nodes;
    }

    test('changes text nodes only, carrying title-case word state across them', () => {
        const nodes = formatted(parseCellMarkdown('**unit** [price](x.md) `id` **un**it'), 'upper');
        expect(nodes).toEqual(parseCellMarkdown('**UNIT** [PRICE](x.md) `id` **UN**IT'));
        expect(formatted(parseCellMarkdown('**un**it pRICE'), 'title')).toEqual(parseCellMarkdown('**Un**it Price'));
    });

    test('title case restarts at each paragraph', () => {
        expect(formatted(parseCellBlocks('one\n\ntwo'), 'title')).toEqual(parseCellBlocks('One\n\nTwo'));
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

import { describe, expect, test } from 'vitest';

import { applyRowWindow, defaultNumRows, resolveRowWindow } from './rowWindow.js';

const rows = [1, 2, 3, 4, 5];

describe('rowWindow (ADR-0004)', () => {
    test.each`
        options                                          | expected
        ${{}}                                            | ${[1, 2, 3, 4, 5]}
        ${{ startRow: '2', numRows: '2' }}               | ${[2, 3]}
        ${{ endRow: '2' }}                               | ${[1, 2]}
        ${{ startRow: '2', numRows: '10', endRow: '3' }} | ${[2, 3]}
        ${{ startRow: '4', numRows: '1' }}               | ${[4]}
        ${{ startRow: '100' }}                           | ${[]}
        ${{ startRow: '3', endRow: '2' }}                | ${[]}
        ${{ numRows: '0' }}                              | ${[]}
        ${{ endRow: '0' }}                               | ${[]}
    `('$options selects $expected', ({ options, expected }) => {
        expect(applyRowWindow(rows, resolveRowWindow(options))).toEqual(expected);
    });

    test('num-rows defaults to 10,000 rows', () => {
        const many = Array.from({ length: defaultNumRows + 5 }, (_, i) => i + 1);
        const selected = applyRowWindow(many, resolveRowWindow({}));
        expect(selected).toHaveLength(10_000);
        expect(selected.at(-1)).toBe(10_000);
    });

    test.each`
        options                | message
        ${{ startRow: 'abc' }} | ${'Invalid start-row "abc": expected a whole number.'}
        ${{ numRows: '-1' }}   | ${'Invalid num-rows "-1": expected a whole number.'}
        ${{ endRow: '1.5' }}   | ${'Invalid end-row "1.5": expected a whole number.'}
        ${{ startRow: '' }}    | ${'Invalid start-row "": expected a whole number.'}
        ${{ startRow: '0' }}   | ${'Invalid start-row "0": row numbers start at 1.'}
    `('rejects $options', ({ options, message }) => {
        expect(() => resolveRowWindow(options)).toThrow(message);
    });
});

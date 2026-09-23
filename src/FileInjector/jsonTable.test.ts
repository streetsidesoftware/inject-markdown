import { describe, expect, test } from 'vitest';

import { jsonToRows, mapJsonStrings } from './jsonTable.js';
import { resolveRowWindow } from './rowWindow.js';

const all = resolveRowWindow({});
const people = JSON.stringify([
    { name: 'Ada', born: 1815 },
    { name: 'Grace', role: 'Admiral' },
]);

describe('jsonToRows (ADR-0011)', () => {
    test('columns are the union of keys in first-seen order; missing keys are empty', () => {
        expect(jsonToRows(people, all)).toEqual([
            ['name', 'born', 'role'],
            ['Ada', '1815', ''],
            ['Grace', '', 'Admiral'],
        ]);
    });

    test('scalars use String(), null is empty, nested values stay JSON', () => {
        const rows = jsonToRows('[{"n":1.50,"b":false,"z":null,"o":{"x":1},"a":[1]}]', all);
        expect(rows[1]).toEqual(['1.5', 'false', '', { json: { x: 1 } }, { json: [1] }]);
    });

    test('columns come from the elements in the row window', () => {
        expect(jsonToRows(people, resolveRowWindow({ startRow: '2' }))).toEqual([
            ['name', 'role'],
            ['Grace', 'Admiral'],
        ]);
    });

    test('an empty window keeps a header of all keys', () => {
        expect(jsonToRows(people, resolveRowWindow({ startRow: '100' }))).toEqual([['name', 'born', 'role']]);
    });

    test.each`
        text                | message
        ${'[{"a":1},]'}     | ${'Invalid JSON: '}
        ${'{"items":[]}'}   | ${'Expected a JSON array of objects, found an object.'}
        ${'"text"'}         | ${'Expected a JSON array of objects, found a string.'}
        ${'null'}           | ${'Expected a JSON array of objects, found null.'}
        ${'[]'}             | ${'Expected a JSON array of objects, found an empty array.'}
        ${'[{"a":1},2]'}    | ${'Expected a JSON array of objects, but element 2 is a number.'}
        ${'[["a"],["b"]]'}  | ${'Expected a JSON array of objects, but element 1 is an array.'}
        ${'[{"a":1},null]'} | ${'Expected a JSON array of objects, but element 2 is null.'}
    `('rejects $text', ({ text, message }) => {
        expect(() => jsonToRows(text, all)).toThrow(message);
    });

    test('a non-object outside the window is still an error', () => {
        expect(() => jsonToRows('[{"a":1},2]', resolveRowWindow({ endRow: '1' }))).toThrow('element 2 is a number');
    });
});

describe('mapJsonStrings', () => {
    test('maps string leaves only, leaving keys and other values alone', () => {
        const value = { k: 'v', n: 1, list: ['a', { deep: 'b' }], nil: null };
        expect(mapJsonStrings(value, (s) => s.toUpperCase())).toEqual({
            k: 'V',
            n: 1,
            list: ['A', { deep: 'B' }],
            nil: null,
        });
    });
});

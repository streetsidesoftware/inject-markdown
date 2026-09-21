import { describe, expect, test } from 'vitest';

import { delimiterForExtension, parseDelimitedText } from './csv.js';

describe('parseDelimitedText', () => {
    test('parses simple comma separated rows', () => {
        expect(parseDelimitedText('a,b,c\n1,2,3\n', ',')).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
        ]);
    });

    test('parses without a trailing newline', () => {
        expect(parseDelimitedText('a,b\n1,2', ',')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    test('parses tab separated rows', () => {
        expect(parseDelimitedText('a\tb\n1\t2\n', '\t')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    test('handles quoted fields with embedded delimiters and quotes', () => {
        expect(parseDelimitedText('name,note\nBob,"Los Angeles, ""CA"""\n', ',')).toEqual([
            ['name', 'note'],
            ['Bob', 'Los Angeles, "CA"'],
        ]);
    });

    test('handles quoted fields with embedded newlines', () => {
        expect(parseDelimitedText('a,b\n"line1\nline2",2\n', ',')).toEqual([
            ['a', 'b'],
            ['line1\nline2', '2'],
        ]);
    });

    test('returns an empty array for empty content', () => {
        expect(parseDelimitedText('', ',')).toEqual([]);
    });
});

describe('delimiterForExtension', () => {
    test.each`
        ext       | expected
        ${'.csv'} | ${','}
        ${'.tsv'} | ${'\t'}
        ${'.CSV'} | ${','}
        ${'.TSV'} | ${'\t'}
        ${'.txt'} | ${','}
    `('$ext -> delimiter', ({ ext, expected }) => {
        expect(delimiterForExtension(ext)).toBe(expected);
    });
});

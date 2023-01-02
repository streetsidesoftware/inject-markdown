import { describe, expect, test } from 'vitest';
import { fileType } from './fileType.mjs';

describe('fileType', () => {
    test.each`
        filename       | expected
        ${''}          | ${''}
        ${'code.ts'}   | ${'ts'}
        ${'code.mts'}  | ${'typescript'}
        ${'code.cts'}  | ${'typescript'}
        ${'code.js'}   | ${'js'}
        ${'code.mjs'}  | ${'javascript'}
        ${'code.cjs'}  | ${'javascript'}
        ${'README.md'} | ${'markdown'}
        ${'.eslintrc'} | ${''}
        ${'data.txt'}  | ${''}
        ${'data.csv'}  | ${'csv'}
    `('fileType($filename)', ({ filename, expected }) => {
        expect(fileType(filename)).toEqual(expected);
    });
});

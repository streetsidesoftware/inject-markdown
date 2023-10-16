import { describe, expect, test } from 'vitest';

import { toError, toString } from './utils.js';

describe('utils', () => {
    test.each`
        value                 | expected
        ${'hello'}            | ${Error('hello')}
        ${Error('hello')}     | ${Error('hello')}
        ${{ code: 'ENOENT' }} | ${{ code: 'ENOENT' }}
        ${undefined}          | ${Error('Unknown')}
    `('toError $value', ({ value, expected }) => {
        expect(toError(value)).toEqual(expected);
    });

    test.each`
        value                                    | expected
        ${'hello'}                               | ${'hello'}
        ${Buffer.from('hello')}                  | ${'hello'}
        ${Uint8Array.from(Buffer.from('hello'))} | ${'hello'}
    `('toString $value', ({ value, expected }) => {
        expect(toString(value, 'utf8')).toEqual(expected);
    });
});

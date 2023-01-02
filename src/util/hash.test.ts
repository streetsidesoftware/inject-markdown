import { describe, expect, test } from 'vitest';
import { parseHashString } from './hash.js';

const e = encodeURI;

describe('hash', () => {
    test.each`
        hash                                    | expected
        ${''}                                   | ${{}}
        ${'#'}                                  | ${{}}
        ${'#L1-L10'}                            | ${{ lines: [1, 10], params: m('L1-L10') }}
        ${'#lines=L1-L10'}                      | ${{ lines: [1, 10], params: m('lines=L1-L10') }}
        ${'#line=L10'}                          | ${{ lines: [10, 10], params: m('line=L10') }}
        ${'#lang=ts&line=L10'}                  | ${{ lang: 'ts', lines: [10, 10], params: m('line=L10', 'lang=ts') }}
        ${'#Chapter 3: Related Information'}    | ${{ tags: ['Chapter 3: Related Information'], params: m('Chapter 3: Related Information') }}
        ${e('#Chapter 3: Related Information')} | ${{ tags: ['Chapter 3: Related Information'], params: m('Chapter 3: Related Information') }}
    `('parseHashString($hash)', ({ hash, expected }) => {
        expect(parseHashString(hash)).toEqual(expected);
    });
});

function m(...entries: ([string, string | string[]] | string)[]): Map<string, string | string[]> {
    return new Map(
        entries.map((e) => {
            if (typeof e === 'string') {
                const [key, value = ''] = e.split('=', 2);
                return [key, value];
            }
            return e;
        })
    );
}

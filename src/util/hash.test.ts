import { describe, expect, test } from 'vitest';

import { parseHashString } from './hash.js';

const e = encodeURIComponent;

describe('hash', () => {
    test.each`
        hash                                 | expected
        ${''}                                | ${{}}
        ${'#'}                               | ${{}}
        ${'#L1-L10'}                         | ${{ lines: [1, 10], params: m('L1-L10') }}
        ${'#L0-L0'}                          | ${{ tags: ['L0-L0'], params: m('L0-L0') }}
        ${'#L0-L0&Heading 2'}                | ${{ heading: 'Heading 2', tags: ['L0-L0', 'Heading 2'], params: m('L0-L0', 'Heading 2') }}
        ${'#lines=L1-L10'}                   | ${{ lines: [1, 10], params: m('lines=L1-L10') }}
        ${'#line=L10'}                       | ${{ lines: [10, 10], params: m('line=L10') }}
        ${'#lang=ts&line=L10'}               | ${{ lang: 'ts', lines: [10, 10], params: m('line=L10', 'lang=ts') }}
        ${'#Chapter 3: Related Information'} | ${{ heading: 'Chapter 3: Related Information', tags: ['Chapter 3: Related Information'], params: m('Chapter 3: Related Information') }}
        ${'#' + e('Chapter 3: Information')} | ${{ heading: 'Chapter 3: Information', tags: ['Chapter 3: Information'], params: m('Chapter 3: Information') }}
        ${'#' + e('A=B')}                    | ${{ heading: 'A=B', tags: ['A=B'], params: m('A%3DB') }}
        ${'#code=js'}                        | ${{ lang: 'js', params: m('code=js') }}
        ${'#etag=3jk4dh4s'}                  | ${{ params: m('etag=3jk4dh4s') }}
        ${'#v=1&v=2&v=3'}                    | ${{ params: m(['v', ['1', '2', '3']]) }}
        ${'#lang=js&lang=ts'}                | ${{ lang: 'ts', params: m(['lang', ['js', 'ts']]) }}
        ${'#line=5'}                         | ${{ params: m('line=5') }}
        ${'#heading=First'}                  | ${{ heading: 'First', params: m('heading=First') }}
    `('parseHashString($hash)', ({ hash, expected }) => {
        expect(parseHashString(hash)).toEqual(expected);
    });
});

function m(...entries: ([string, string | string[]] | string)[]): Map<string, string | string[]> {
    return new Map(
        entries.map((e) => {
            if (typeof e === 'string') {
                const [key, value = ''] = e.split('=', 2);
                return [decodeURIComponent(key), decodeURIComponent(value)];
            }
            return e;
        })
    );
}

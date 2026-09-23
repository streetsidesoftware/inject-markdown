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

    test('#values=name:1.2.3', () => {
        expect(parseHashString('#values=name:1.2.3')).toEqual({
            values: new Map([['name', '1.2.3']]),
            params: m('values=name:1.2.3'),
        });
    });

    test('#values-file=pkg:package.json', () => {
        expect(parseHashString('#values-file=pkg:package.json')).toEqual({
            valuesFile: [{ prefixKind: 'explicit', prefixName: 'pkg', path: 'package.json' }],
            params: m('values-file=pkg:package.json'),
        });
    });

    test('#vars (bare flag)', () => {
        expect(parseHashString('#vars')).toEqual({
            vars: true,
            params: m('vars'),
        });
    });

    test('#markdown (bare flag) is not taken as a heading', () => {
        expect(parseHashString('#markdown')).toEqual({
            markdown: true,
            params: m('markdown'),
        });
        expect(parseHashString('#markdown=false').markdown).toBe(false);
    });

    test('#html-table (bare flag) is not taken as a heading', () => {
        expect(parseHashString('#html-table')).toEqual({
            htmlTable: true,
            params: m('html-table'),
        });
        expect(parseHashString('#html-table=false').htmlTable).toBe(false);
    });

    test('row window options are captured as raw strings, not headings', () => {
        expect(parseHashString('#start-row=2&end-row=5&num-rows=3')).toEqual({
            startRow: '2',
            endRow: '5',
            numRows: '3',
            params: m('start-row=2', 'end-row=5', 'num-rows=3'),
        });
        expect(parseHashString('#start-row').heading).toBeUndefined();
    });

    test('header-rows is captured raw; bare #header-rows is an empty value', () => {
        expect(parseHashString('#header-rows=2').headerRows).toBe('2');
        expect(parseHashString('#header-rows')).toEqual({ headerRows: '', params: m('header-rows') });
    });
});

describe('repeated hash keys (ADR-0011)', () => {
    test('a repeated values-file= is identical to the equivalent comma list', () => {
        const repeated = parseHashString('#values-file=:./package.json&values-file=release:releases.json');
        const commaList = parseHashString('#values-file=:./package.json,release:releases.json');
        expect(repeated.valuesFile).toEqual(commaList.valuesFile);
        expect(repeated.valuesFile).toHaveLength(2);
    });

    test('a repeated values= accumulates, and a repeated name last-wins', () => {
        const info = parseHashString('#values=a:1&values=b:2&values=a:3');
        expect([...(info.values ?? [])]).toEqual([
            ['a', '3'],
            ['b', '2'],
        ]);
    });

    test('a repeated value-alias= accumulates', () => {
        const info = parseHashString('#value-alias=x:y&value-alias=p:q');
        expect([...(info.valueAlias ?? [])]).toEqual([
            ['x', 'y'],
            ['p', 'q'],
        ]);
    });

    test('a repeated scalar key silently last-wins', () => {
        expect(parseHashString('#heading=Install&heading=Usage').heading).toBe('Usage');
        expect(parseHashString('#lang=ts&lang=js').lang).toBe('js');
        expect(parseHashString('#quote=true&quote=false').quote).toBe(false);
    });

    test('a repeated line range still last-wins, multi-range being out of scope', () => {
        expect(parseHashString('#L1-L10&L20-L30').lines).toEqual([20, 30]);
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
        }),
    );
}

import { describe, expect, test } from 'vitest';

import { parseDirective } from './Directive.js';

describe('parseDirective', () => {
    test.each`
        html                                              | expectedType
        ${'<!--- @@inject: data.csv --->'}                | ${'table'}
        ${'<!--- @@inject-start: data.csv --->'}          | ${'table'}
        ${'<!--- @@inject: data.tsv --->'}                | ${'table'}
        ${'<!--- @@inject: data.csv#lang=csv --->'}       | ${'code'}
        ${'<!--- @@inject: data.csv#code=csv --->'}       | ${'code'}
        ${'<!--- @@inject-code: data.csv --->'}           | ${'code'}
        ${'<!--- @@inject-table: data.csv --->'}          | ${'table'}
        ${'<!--- @@inject-table: notes.txt --->'}         | ${'table'}
        ${'<!--- @@inject-table: data.csv#lang=csv --->'} | ${'table'}
        ${'<!--- @@inject: readme.md --->'}               | ${'start'}
        ${'<!--- @@inject: notes.txt --->'}               | ${'code'}
        ${'<!--- @@inject-end: data.csv --->'}            | ${'end'}
    `('$html -> $expectedType', ({ html, expectedType }) => {
        const d = parseDirective(html);
        expect(d?.type).toBe(expectedType);
    });

    test('returns undefined for non-directive html', () => {
        expect(parseDirective('<!--- not a directive --->')).toBeUndefined();
    });
});

import type { Root } from 'mdast';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { isPathRelativeUrl, rebaseLinks, rebaseUrl } from './rebaseLinks.js';

const host = new URL('file:///repo/README.md');
const source = new URL('file:///repo/docs/part.md');

describe('isPathRelativeUrl', () => {
    test.each`
        url                     | expected
        ${'x.md'}               | ${true}
        ${'./x.md'}             | ${true}
        ${'../x.md'}            | ${true}
        ${'img/a.png'}          | ${true}
        ${'?plain=1'}           | ${true}
        ${''}                   | ${false}
        ${'#section'}           | ${false}
        ${'/docs/x.md'}         | ${false}
        ${'//host/x.md'}        | ${false}
        ${'https://a.b/x.md'}   | ${false}
        ${'mailto:a@b.c'}       | ${false}
        ${'data:image/png,abc'} | ${false}
        ${'file:///x.md'}       | ${false}
    `('$url', ({ url, expected }) => {
        expect(isPathRelativeUrl(url)).toBe(expected);
    });
});

describe('rebaseUrl', () => {
    test.each`
        url                     | src                                                            | expected
        ${'img/flow.png'}       | ${source}                                                      | ${'docs/img/flow.png'}
        ${'./img/x.png'}        | ${source}                                                      | ${'docs/img/x.png'}
        ${'../LICENSE'}         | ${source}                                                      | ${'LICENSE'}
        ${'../../other/x.md'}   | ${source}                                                      | ${'../other/x.md'}
        ${'a/../x.png'}         | ${source}                                                      | ${'docs/x.png'}
        ${'x.md?plain=1#usage'} | ${source}                                                      | ${'docs/x.md?plain=1#usage'}
        ${'my%20file.png'}      | ${source}                                                      | ${'docs/my%20file.png'}
        ${'my file.png'}        | ${source}                                                      | ${'docs/my file.png'}
        ${'sub/'}               | ${source}                                                      | ${'docs/sub/'}
        ${'../'}                | ${source}                                                      | ${'./'}
        ${'..'}                 | ${source}                                                      | ${'./'}
        ${'../README.md#usage'} | ${source}                                                      | ${'README.md#usage'}
        ${'?plain=1'}           | ${source}                                                      | ${'docs/part.md?plain=1'}
        ${'#section'}           | ${source}                                                      | ${'#section'}
        ${'/abs.md'}            | ${source}                                                      | ${'/abs.md'}
        ${'https://a.b/x.png'}  | ${source}                                                      | ${'https://a.b/x.png'}
        ${'./x.png'}            | ${new URL('file:///repo/sibling.md')}                          | ${'./x.png'}
        ${'a/../x.png'}         | ${new URL('file:///repo/sibling.md#L1')}                       | ${'a/../x.png'}
        ${'x.png'}              | ${new URL('file:///repo/docs/part.md#h=x')}                    | ${'docs/x.png'}
        ${'img.png'}            | ${new URL('https://github.com/o/r/blob/main/docs/x.md#L1-L5')} | ${'https://github.com/o/r/blob/main/docs/img.png'}
        ${'../y.md?q=1#f'}      | ${new URL('https://example.com/a/b/x.md')}                     | ${'https://example.com/a/y.md?q=1#f'}
        ${'#frag'}              | ${new URL('https://example.com/a/b/x.md')}                     | ${'#frag'}
    `('$url from $src', ({ url, src, expected }) => {
        expect(rebaseUrl(url, src, host)).toBe(expected);
    });

    test('host deeper than source', () => {
        const deepHost = new URL('file:///repo/a/b/README.md');
        expect(rebaseUrl('img.png', new URL('file:///repo/c/part.md'), deepHost)).toBe('../../c/img.png');
    });
});

describe('rebaseLinks', () => {
    function rebase(md: string): string {
        const tree = unified().use(remarkParse).parse(md) as Root;
        rebaseLinks(tree, source, host);
        return unified().use(remarkStringify).stringify(tree);
    }

    test('links, images and definitions', () => {
        expect(rebase('[a](x.md) ![b](img/b.png) [c][ref] <https://a.b>\n\n[ref]: c.md "title"\n')).toBe(
            '[a](docs/x.md) ![b](docs/img/b.png) [c][ref] <https://a.b>\n\n[ref]: docs/c.md "title"\n',
        );
    });

    test('raw HTML and code are left alone', () => {
        const md = '<img src="x.png">\n\n`[a](x.md)`\n\n```md\n[a](x.md)\n```\n';
        expect(rebase(md)).toBe(md);
    });
});

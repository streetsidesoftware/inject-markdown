import assert from 'node:assert';
import { pathToFileURL } from 'node:url';

import { describe, expect, test } from 'vitest';

import { dirToUrl, isURL, parseRelativeUrl, pathToUrl, relativePath, urlDirectory } from './url_helper.js';

describe('url_helper', () => {
    test.each`
        url                         | expected
        ${undefined}                | ${false}
        ${'https://google.com/'}    | ${false}
        ${u('https://google.com/')} | ${true}
        ${pathToFileURL('.')}       | ${true}
    `('isURL $url', ({ url, expected }) => {
        expect(isURL(url)).toBe(expected);
    });

    test.each`
        url                           | rel                                         | expected
        ${'https://google.com/'}      | ${undefined}                                | ${u('https://google.com/')}
        ${''}                         | ${u('https://google.com')}                  | ${u('https://google.com/')}
        ${'/docs'}                    | ${u('https://example.com/code/')}           | ${u('https://example.com/docs')}
        ${'docs'}                     | ${u('https://example.com/code/')}           | ${u('https://example.com/code/docs')}
        ${'docs'}                     | ${u('https://example.com/code/index.html')} | ${u('https://example.com/code/docs')}
        ${'docs/README.md#Heading 1'} | ${u('https://example.com/project/')}        | ${u('https://example.com/project/docs/README.md#Heading%201')}
        ${''}                         | ${undefined}                                | ${pathToFileURL('.')}
        ${'README.md'}                | ${undefined}                                | ${pathToFileURL('./README.md')}
        ${'README.md#L10-L30'}        | ${undefined}                                | ${u('README.md#L10-L30', pathToFileURL('./'))}
        ${'README.md?q=42#Q&A'}       | ${undefined}                                | ${u('README.md?q=42#Q&A', pathToFileURL('./'))}
        ${'My file.md?q=42#Q&A'}      | ${undefined}                                | ${u('My file.md?q=42#Q&A', pathToFileURL('./'))}
        ${'README.md'}                | ${pathToFileURL('./examples/')}             | ${pathToFileURL('./examples/README.md')}
        ${'README.md#L42-L60'}        | ${pathToFileURL('./examples/')}             | ${u('README.md#L42-L60', pathToFileURL('./examples/'))}
    `('pathToUrl $url $rel', ({ url, rel, expected }) => {
        expect(pathToUrl(url, rel).toString()).toBe(expected.toString());
    });

    test.each`
        url                      | rel                                         | expected
        ${'https://google.com/'} | ${undefined}                                | ${u('https://google.com/')}
        ${'https://google.com'}  | ${undefined}                                | ${u('https://google.com/')}
        ${'https://google.com'}  | ${u('https://example.com')}                 | ${u('https://google.com/')}
        ${'..'}                  | ${u('https://example.com')}                 | ${u('https://example.com/')}
        ${'/docs'}               | ${u('https://example.com/code/')}           | ${u('https://example.com/docs/')}
        ${'docs'}                | ${u('https://example.com/code/')}           | ${u('https://example.com/code/docs/')}
        ${'docs'}                | ${u('https://example.com/code/index.html')} | ${u('https://example.com/code/docs/')}
        ${''}                    | ${undefined}                                | ${pathToFileURL('./')}
        ${pathToFileURL('')}     | ${undefined}                                | ${pathToFileURL('./')}
        ${'examples'}            | ${undefined}                                | ${pathToFileURL('./examples/')}
        ${'../test/fixtures'}    | ${pathToFileURL('./examples/')}             | ${pathToFileURL('./test/fixtures/')}
    `('dirToUrl $url $rel.href', ({ url, rel, expected }) => {
        rememberUrl(...[url, rel, expected].filter(isURL));
        expect(dirToUrl(url, rel).toString()).toBe(expected.toString());
        assertUrlHasNotChanged(...[url, rel, expected].filter(isURL));
    });

    test.each`
        fromUrl                      | toUrl                                              | expected
        ${u('https://g.com/')}       | ${u('https://g.com/')}                             | ${''}
        ${u('https://g.com/')}       | ${u('https://g.com/examples/code/sample.ts')}      | ${'examples/code/sample.ts'}
        ${u('https://g.com/images')} | ${u('https://g.com/examples/code/sample.ts')}      | ${'../examples/code/sample.ts'}
        ${u('https://g.com/images')} | ${u('https://ex.com/examples/code/sample.ts')}     | ${'../examples/code/sample.ts'}
        ${u('https://g.com/images')} | ${u('https://ex.com/examples/sample.ts?q=42#L10')} | ${'../examples/sample.ts?q=42#L10'}
        ${pathToFileURL('.')}        | ${pathToFileURL('.')}                              | ${''}
    `('relativePath $fromUrl.href $toUrl.href', ({ fromUrl, toUrl, expected }) => {
        rememberUrl(fromUrl, toUrl);
        expect(relativePath(fromUrl, toUrl).toString()).toBe(expected);
        assertUrlHasNotChanged(fromUrl, toUrl);
    });

    test.each`
        url                                       | expected
        ${u('https://g.com/')}                    | ${u('https://g.com/')}
        ${u('https://g.com/images')}              | ${u('https://g.com/')}
        ${pathToFileURL('.')}                     | ${pathToFileURL('../')}
        ${pathToFileURL('./README.md')}           | ${pathToFileURL('./')}
        ${u('https://g.com/project/src/file.ts')} | ${u('https://g.com/project/src/')}
    `('urlDirectory $url.href', ({ url, expected }) => {
        rememberUrl(url);
        expect(urlDirectory(url).toString()).toBe(expected.toString());
        assertUrlHasNotChanged(url);
    });

    test.each`
        url                            | expected
        ${'https://g.com/images'}      | ${'https://g.com/images'}
        ${'README.md?lang=en#L40-L44'} | ${'README.md?lang=en#L40-L44'}
        ${'./README.md#Chapter 1'}     | ${'./README.md#Chapter%201'}
        ${'../src/file.ts#offset=333'} | ${'../src/file.ts#offset=333'}
    `('parseRelativeUrl $url', ({ url, expected }) => {
        expect(parseRelativeUrl(url).toString()).toBe(expected.toString());
    });

    const urlGitHubRaw =
        'https://raw.githubusercontent.com/streetsidesoftware/inject-markdown/d7de2f5fe5f894df712c71d05eb3450ead944e73/src/app.mts#L22-L25';

    test.each`
        url                            | baseUrl              | expected
        ${'https://g.com/images'}      | ${pathToFileURL('')} | ${'https://g.com/images'}
        ${'README.md?lang=en#L40-L44'} | ${pathToFileURL('')} | ${u('README.md?lang=en#L40-L44', pathToFileURL(''))}
        ${'./README.md#Chapter 1'}     | ${pathToFileURL('')} | ${u('README.md#Chapter%201', pathToFileURL(''))}
        ${'../src/file.ts#offset=333'} | ${pathToFileURL('')} | ${u('src/file.ts#offset=333', pathToFileURL('..'))}
        ${urlGitHubRaw}                | ${pathToFileURL('')} | ${urlGitHubRaw}
    `('parseRelativeUrl($url).toUrl($baseUrl.href)', ({ url, baseUrl, expected }) => {
        expect(parseRelativeUrl(url).toUrl(baseUrl).toString()).toBe(expected.toString());
    });
});

function u(input: string, base?: string | URL): URL {
    return new URL(input, base);
}

const knownUrls = new WeakMap<URL, string>();

function rememberUrl(...urls: URL[]): void {
    urls.forEach((url) => knownUrls.set(url, url.href));
}

function assertUrlHasNotChanged(...urls: URL[]): void {
    urls.forEach((url) => assert(knownUrls.get(url) === url.href, 'Url has changed.'));
}

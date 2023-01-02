import { describe, expect, test } from 'vitest';
import * as fsa from './fsa.js';
import { pathToUrl } from './url_helper.js';

describe('fsa', () => {
    test.each`
        file
        ${import.meta.url}
        ${'README.md'}
        ${'README.md#Amsterdam'}
        ${'https://raw.githubusercontent.com/streetsidesoftware/inject-markdown/df4cdb07d70f6d9247ea14a3ea4fa7b4512d329f/README.md'}
    `('readFile $file.toString()', async ({ file }) => {
        const fa = fsa.nodeFsa();
        const url = pathToUrl(file);
        await expect(fa.readFile(url, 'utf8')).resolves.toBeDefined();
    });

    test.each`
        file
        ${'https://raw.githubusercontent.com/streetsidesoftware/inject-markdown/df4cdb07d70f6d9247ea14a3ea4fa7b4512d329f/README.md#L5-L10'}
        ${'https://raw.githubusercontent.com/streetsidesoftware/inject-markdown/d7de2f5fe5f894df712c71d05eb3450ead944e73/src/app.mts#L22-L25'}
    `('readFile $file.toString()', async ({ file }) => {
        const fa = fsa.nodeFsa();
        const url = pathToUrl(file);
        await expect(fa.readFile(url, 'utf8')).resolves.toMatchSnapshot();
    });
});

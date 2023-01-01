import { describe, expect, test } from 'vitest';
import * as fsa from './fsa.js';
import { pathToUrl } from './url_helper.js';

describe('fsa', () => {
    test.each`
        file
        ${import.meta.url}
        ${'README.md'}
        ${'README.md#Amsterdam'}
    `('readFile $file.toString()', async ({ file }) => {
        const fa = fsa.nodeFsa();
        const url = pathToUrl(file);
        await expect(fa.readFile(url, 'utf8')).resolves.toBeDefined();
    });
});

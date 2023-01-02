import { pathToFileURL } from 'url';
import { VFile } from 'vfile';
import { describe, expect, test } from 'vitest';
import { reportFileErrors } from './reportFileErrors.mjs';

const sc = (s: string) => expect.stringContaining(s);

describe('reportFileErrors', () => {
    test.each`
        messages                                   | expected
        ${[]}                                      | ${''}
        ${['Unable to parse @@inject directive.']} | ${sc('Unable to parse @@inject directive.')}
    `('reportFileErrors', ({ messages, expected }) => {
        const fileUrl = pathToFileURL('README.md');
        const content = '# README.md\n\nLine 1.\n';
        const vFile = new VFile({ path: fileUrl, content });
        const errorMessages: string[] = messages;
        errorMessages.forEach((m) => vFile.message(m));
        const report = reportFileErrors(vFile);
        expect(report).toEqual(expected);
    });
});

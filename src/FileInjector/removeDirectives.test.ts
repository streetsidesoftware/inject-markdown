import { readFile } from 'node:fs/promises';

import { globby } from 'globby';
import * as path from 'path';
import { visit } from 'unist-util-visit';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';

import { isDirectiveComment, markdownParser } from './Markdown.js';
import { removeDirectives } from './removeDirectives.js';

const __root__ = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('removeDirectives', () => {
    test('keeps the injected content and drops the markers', () => {
        const md = [
            '# Title',
            '',
            '<!--- @@inject: code.ts --->',
            '',
            '```ts',
            'const a = 1;',
            '```',
            '',
            '<!--- @@inject-end: code.ts --->',
            '',
            'After.',
            '',
        ].join('\n');
        expect(removeDirectives(md)).toBe(['# Title', '', '```ts', 'const a = 1;', '```', '', 'After.', ''].join('\n'));
    });

    test.each`
        name                      | md
        ${'no directives'}        | ${'# Title\n\n* item\n'}
        ${'directive in code'}    | ${'```markdown\n<!--- @@inject: x.md --->\n```\n'}
        ${'other HTML comment'}   | ${'<!-- a note -->\n\ntext\n'}
        ${'front matter'}         | ${'---\ntitle: x\n---\n\n# Title\n'}
        ${'failed-inject remark'} | ${'<!---\n  Failed to read "x.md"\n--->\n'}
    `('leaves Markdown without directive comments unchanged: $name', ({ md }) => {
        expect(removeDirectives(md)).toBe(md);
    });

    test.each`
        name                          | md                                                                          | expected
        ${'at the start'}             | ${'<!--- @@inject: a.md --->\n\nA\n'}                                       | ${'A\n'}
        ${'at the end'}               | ${'A\n\n<!--- @@inject-end: a.md --->\n'}                                   | ${'A\n'}
        ${'no trailing \\n'}          | ${'A\n\n<!--- @@inject-end: a.md --->'}                                     | ${'A\n'}
        ${'empty section'}            | ${'P\n\n<!--- @@inject: a.md --->\n\n<!--- @@inject-end: a.md --->\n\nN\n'} | ${'P\n\nN\n'}
        ${'inside a line'}            | ${'Text <!--- @@inject: a.md ---> more\n'}                                  | ${'Text  more\n'}
        ${'CRLF'}                     | ${'P\r\n\r\n<!--- @@inject: a.md --->\r\n\r\nA\r\n'}                        | ${'P\r\n\r\nA\r\n'}
        ${'unmatched end'}            | ${'P\n\n<!--- @@inject-end: a.md --->\n\nN\n'}                              | ${'P\n\nN\n'}
        ${'empty section at the end'} | ${'P\n\n<!--- @@inject: a.md --->\n\n<!--- @@inject-end: a.md --->\n'}      | ${'P\n'}
    `('removes a directive comment: $name', ({ md, expected }) => {
        expect(removeDirectives(md)).toBe(expected);
    });

    test('removes every directive from real injected output, without adding blank lines', async () => {
        const files = await globby('fixtures-output/**/*.md', { cwd: __root__, absolute: true });
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const md = await readFile(file, 'utf8');
            const result = removeDirectives(md);
            expect(directiveCount(result), file).toBe(0);
            expect(countDoubleBlankLines(result), file).toBeLessThanOrEqual(countDoubleBlankLines(md));
        }
    });
});

function directiveCount(md: string): number {
    let count = 0;
    visit(markdownParser(md).parse(md), isDirectiveComment, () => {
        ++count;
    });
    return count;
}

function countDoubleBlankLines(md: string): number {
    return md.replace(/\r\n/g, '\n').split('\n\n\n').length - 1;
}

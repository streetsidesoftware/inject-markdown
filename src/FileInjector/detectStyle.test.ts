import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { detectMarkdownStyle } from './detectStyle.js';

function parse(content: string) {
    return unified().use(remarkParse).use(remarkGfm).parse(content);
}

describe('detectMarkdownStyle', () => {
    test('falls back to defaults for a document with none of the detected constructs', () => {
        const content = 'Just a paragraph of text.\n';
        expect(detectMarkdownStyle(parse(content), content)).toEqual({
            bullet: '-',
            emphasis: '_',
            fence: '`',
            fences: true,
            incrementListMarker: false,
            rule: '-',
            strong: '*',
        });
    });

    test('detects a non-default style used throughout the document', () => {
        const content = `\
* Item one
* Item two

Some *emphasis* and __strong__ text.

~~~js
const a = 1;
~~~

* * *
`;
        expect(detectMarkdownStyle(parse(content), content)).toEqual({
            bullet: '*',
            emphasis: '*',
            fence: '~',
            fences: true,
            incrementListMarker: false,
            rule: '*',
            strong: '_',
        });
    });

    test('detects the ordered list marker', () => {
        const content = '1) one\n2) two\n';
        expect(detectMarkdownStyle(parse(content), content).bulletOrdered).toBe(')');
    });

    test('picks the majority marker when a document mixes styles', () => {
        // A paragraph between each list forces them apart into separate `list`
        // nodes, so each block casts one vote for its own bullet marker.
        const content = `\
- one

text

- two

text

- three

text

* four
`;
        expect(detectMarkdownStyle(parse(content), content).bullet).toBe('-');
    });
});

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { detectMarkdownStyle } from './detectStyle.js';
import type { MarkdownStyle } from './types.js';

/** The style an existing Markdown text uses. A construct the text doesn't use gets the default. */
export function detectStyle(markdown: string): MarkdownStyle {
    const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
    return detectMarkdownStyle(root, markdown);
}

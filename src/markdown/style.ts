import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { detectMarkdownStyle } from './detectStyle.js';

export type BulletMarker = '*' | '+' | '-';
export type OrderedBulletMarker = '.' | ')';
export type EmphasisMarker = '*' | '_';
export type FenceMarker = '`' | '~';
export type RuleMarker = '*' | '-' | '_';

/** How Markdown is written. A field left out keeps the default. */
export interface MarkdownStyle {
    /** The marker of a bulleted list item. */
    bullet?: BulletMarker | undefined;
    /** The marker after the number of an ordered list item. */
    bulletOrdered?: OrderedBulletMarker | undefined;
    /** The marker around emphasized text. */
    emphasis?: EmphasisMarker | undefined;
    /** The marker around strong text, written twice. */
    strong?: EmphasisMarker | undefined;
    /** The character of a code fence. */
    fence?: FenceMarker | undefined;
    /** Whether a code block is fenced, rather than indented. */
    fences?: boolean | undefined;
    /** Whether ordered list numbers count up, rather than repeat. */
    incrementListMarker?: boolean | undefined;
    /** The character of a thematic break. */
    rule?: RuleMarker | undefined;
}

/** The style an existing Markdown text uses. A construct the text doesn't use gets the default. */
export function detectStyle(markdown: string): MarkdownStyle {
    const root = unified().use(remarkParse).use(remarkGfm).parse(markdown);
    return detectMarkdownStyle(root, markdown);
}

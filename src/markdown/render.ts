import type { PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify, { type Options as StyleOptions } from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { Placeholder } from './nodes.js';

export type { Options as StyleOptions } from 'remark-stringify';

/** The style for constructs a value carries no style for. */
export const defaultStyle: StyleOptions = {
    bullet: '-',
    emphasis: '_',
    fence: '`',
    fences: true,
    incrementListMarker: false,
    rule: '-',
    strong: '*',
};

/** A placeholder is written as is. */
const handlers: StyleOptions['handlers'] = {
    placeholder: (node: Placeholder) => node.value,
};

/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
export function renderNodes(children: RootContent[], style: StyleOptions | undefined): string {
    const root: Root = { type: 'root', children: structuredClone(children) };
    visit(root, (node) => {
        if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') trimLines(node.children);
    });
    // A field set to `undefined` keeps the default, rather than falling back to remark's own default.
    const given = Object.entries(style ?? {}).filter(([, value]) => value !== undefined);
    const md = unified()
        .use(remarkGfm)
        .use(remarkStringify, { ...defaultStyle, ...Object.fromEntries(given), handlers })
        .stringify(root);
    return md.replace(/\n$/, '');
}

/**
 * Remove the line endings and line breaks at the start and end of a run of lines, in place.
 * Nothing is on their other side, so they can't display. Kept, they would render as `&#xA;` or a literal `\`.
 */
function trimLines(children: PhrasingContent[]): void {
    while (children.length) {
        const first = children[0];
        if (first.type === 'text') first.value = trimLeadingLineEndings(first.value);
        if (first.type !== 'break' && (first.type !== 'text' || first.value)) break;
        children.shift();
    }
    while (children.length) {
        const last = children[children.length - 1];
        if (last.type === 'text') last.value = trimTrailingLineEndings(last.value);
        if (last.type !== 'break' && (last.type !== 'text' || last.value)) break;
        children.pop();
    }
}

/** The text without its leading spaces, tabs and line endings, when they include a line ending. */
function trimLeadingLineEndings(text: string): string {
    let i = 0;
    while (isBlank(text[i])) ++i;
    return /[\r\n]/.test(text.slice(0, i)) ? text.slice(i) : text;
}

/** The text without its trailing spaces, tabs and line endings, when they include a line ending. */
function trimTrailingLineEndings(text: string): string {
    let i = text.length;
    while (isBlank(text[i - 1])) --i;
    return /[\r\n]/.test(text.slice(i)) ? text.slice(0, i) : text;
}

function isBlank(c: string | undefined): boolean {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

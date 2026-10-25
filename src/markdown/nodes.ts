import type { BlockContent, ListItem, PhrasingContent, RootContent } from 'mdast';

import type { MDValue } from './builders.js';
import { placeholderRegExp } from './placeholders.js';
import type { StyleOptions } from './render.js';

/**
 * The nodes a value renders as, kept out of the value itself.
 * The public types then never mention the node tree.
 */
interface Rendering {
    nodes: RootContent[];
    style: StyleOptions | undefined;
}

const renderings = new WeakMap<object, Rendering>();

/** Record the nodes a value renders as. A value is a Markdown value once it has them. */
export function setNodes(value: MDValue, nodes: RootContent[], style?: StyleOptions): void {
    renderings.set(value, { nodes, style });
}

/** How a Markdown value renders, or `undefined` for anything else. */
export function renderingOf(value: unknown): Rendering | undefined {
    return typeof value === 'object' && value !== null ? renderings.get(value) : undefined;
}

/** Whether a value is a Markdown value, and of one of the given kinds. */
export function isKind(value: unknown, ...kinds: MDValue['kind'][]): value is MDValue {
    return renderingOf(value) !== undefined && kinds.includes((value as MDValue).kind);
}

/**
 * Text nodes for a string.
 * A placeholder is emitted raw, so escaping never touches `{@ name @}`.
 */
export function textNodes(text: string): PhrasingContent[] {
    const nodes: PhrasingContent[] = [];
    let last = 0;
    for (const match of text.matchAll(placeholderRegExp)) {
        if (match[1]) continue;
        if (match.index > last) nodes.push({ type: 'text', value: text.slice(last, match.index) });
        nodes.push({ type: 'html', value: match[0] });
        last = match.index + match[0].length;
    }
    if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
    return nodes;
}

/**
 * The nodes for inline content.
 * @param where - what the content is for, such as `heading content`, for error messages.
 */
export function inlineNodes(content: unknown, where: string): PhrasingContent[] {
    if (typeof content === 'string') return textNodes(content);
    if (Array.isArray(content)) return content.flatMap((c: unknown) => inlineNodes(c, where));
    const rendering = renderingOf(content);
    if (rendering && isKind(content, 'inline', 'comment')) return rendering.nodes as PhrasingContent[];
    throw new TypeError(`${where} must be inline, got ${describe(content)}`);
}

/**
 * The nodes for block content.
 * @param where - what the content is for, for error messages.
 */
export function blockNodes(content: unknown, where: string): RootContent[] {
    if (Array.isArray(content)) return content.flatMap((c: unknown) => blockNodes(c, where));
    const rendering = renderingOf(content);
    if (rendering && isKind(content, 'block', 'comment')) return rendering.nodes;
    throw new TypeError(`${where} must be blocks, got ${describe(content)}`);
}

/** Whether content is blocks: a block value, or a non-empty array of them. */
export function isBlockContent(content: unknown): boolean {
    if (Array.isArray(content)) return content.length > 0 && content.every(isBlockContent);
    return isKind(content, 'block');
}

/** What a value is, for error messages. */
export function describe(value: unknown): string {
    if (renderingOf(value)) return (value as MDValue).description;
    if (Array.isArray(value)) return 'an array';
    if (value === null || value === undefined) return String(value);
    return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** A list item from its pieces: inline pieces in a row form a paragraph, and blocks follow. */
export function listItemNode(content: readonly unknown[]): ListItem {
    const children: BlockContent[] = [];
    let line: PhrasingContent[] = [];
    const endLine = () => {
        if (line.length) children.push({ type: 'paragraph', children: line });
        line = [];
    };
    const add = (piece: unknown) => {
        if (Array.isArray(piece)) return piece.forEach(add);
        if (isBlockContent(piece)) {
            endLine();
            children.push(...(blockNodes(piece, 'list item content') as BlockContent[]));
            return;
        }
        line.push(...inlineNodes(piece, 'list item content'));
    };
    content.forEach(add);
    endLine();
    return { type: 'listItem', spread: false, children };
}

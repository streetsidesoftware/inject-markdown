import type { BlockContent as MdastBlockContent, ListItem, PhrasingContent, RootContent } from 'mdast';

import { placeholderRegExp } from './placeholders.js';
import { renderNodes, type StyleOptions } from './render.js';
import type { AnyContent, BlockContent, InlineContent, ListItemContent, MDKind, MDListItem, MDValue } from './types.js';

/**
 * The key a value's rendering is stored under. Having it is what makes a value a Markdown value.
 * It comes from the global symbol registry, so another loaded copy of this module recognizes the value too.
 */
const renderingKey = Symbol.for('@streetsidesoftware/markdown-builders.value');

/** The nodes a value renders as, and the style to render them in. */
interface Rendering {
    nodes: RootContent[];
    style: StyleOptions | undefined;
}

/**
 * A Markdown value. The public types are interfaces, so the node tree never appears in them.
 * The literal kind and description types tell the public types apart.
 */
export class MarkdownValue<K extends MDKind = MDKind, D extends string = string> {
    readonly [renderingKey]: Rendering;

    constructor(
        readonly kind: K,
        readonly description: D,
        nodes: RootContent[],
        style?: StyleOptions,
    ) {
        this[renderingKey] = { nodes, style };
    }

    toString(): string {
        const { nodes, style } = this[renderingKey];
        if (this.kind === 'inline') {
            return renderNodes([{ type: 'paragraph', children: nodes as PhrasingContent[] }], style);
        }
        if (this.kind === 'listItem') {
            return renderNodes([{ type: 'list', ordered: false, spread: false, children: nodes as ListItem[] }], style);
        }
        return renderNodes(nodes, style);
    }
}

/** How a Markdown value renders, or `undefined` for anything else. */
export function renderingOf(value: unknown): Rendering | undefined {
    return typeof value === 'object' && value !== null
        ? (value as Partial<Record<typeof renderingKey, Rendering>>)[renderingKey]
        : undefined;
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
export function inlineNodes(content: InlineContent, where: string): PhrasingContent[] {
    if (typeof content === 'string') return textNodes(content);
    if (isArray(content)) return content.flatMap((c) => inlineNodes(c, where));
    const rendering = renderingOf(content);
    if (rendering && isKind(content, 'inline', 'comment')) return rendering.nodes as PhrasingContent[];
    throw new TypeError(`${where} must be inline, got ${describe(content)}`);
}

/**
 * The nodes for block content.
 * @param where - what the content is for, for error messages.
 */
export function blockNodes(content: BlockContent, where: string): RootContent[] {
    if (isArray(content)) return content.flatMap((c) => blockNodes(c, where));
    const rendering = renderingOf(content);
    if (rendering && isKind(content, 'block', 'comment')) return rendering.nodes;
    throw new TypeError(`${where} must be blocks, got ${describe(content)}`);
}

/** Whether content is blocks: a block value, or a non-empty array of them. */
export function isBlockContent(content: unknown): content is BlockContent {
    if (Array.isArray(content)) return content.length > 0 && content.every(isBlockContent);
    return isKind(content, 'block');
}

/** Whether a value is a list item made by `listItem`. */
export function isListItem(value: unknown): value is MDListItem {
    return isKind(value, 'listItem');
}

/** `Array.isArray`, narrowing readonly arrays too. */
export function isArray<T>(value: T | readonly T[]): value is readonly T[] {
    return Array.isArray(value);
}

/** What a value is, for error messages. */
export function describe(value: unknown): string {
    if (renderingOf(value)) return (value as MDValue).description;
    if (Array.isArray(value)) return 'an array';
    if (value === null || value === undefined) return String(value);
    return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** A run of inline pieces that form one line, or a single block. */
export type Run = { readonly inline: InlineContent[] } | { readonly block: BlockContent };

/**
 * Pieces in order, as runs of inline pieces and the blocks between them.
 * Arrays are flattened.
 */
export function runs(content: AnyContent): Run[] {
    const result: Run[] = [];
    let line: InlineContent[] = [];
    function endLine(): void {
        if (line.length) result.push({ inline: line });
        line = [];
    }
    function add(piece: AnyContent): void {
        if (isArray(piece)) {
            piece.forEach(add);
            return;
        }
        if (isBlockContent(piece)) {
            endLine();
            result.push({ block: piece });
            return;
        }
        line.push(piece);
    }
    add(content);
    endLine();
    return result;
}

/** A list item from its pieces: each run of inline pieces forms a paragraph, and blocks follow. */
export function listItemNode(content: readonly ListItemContent[]): ListItem {
    const where = 'list item content';
    const children = runs(content).flatMap((run): MdastBlockContent[] =>
        'inline' in run
            ? [{ type: 'paragraph', children: inlineNodes(run.inline, where) }]
            : (blockNodes(run.block, where) as MdastBlockContent[]),
    );
    return { type: 'listItem', spread: false, children };
}

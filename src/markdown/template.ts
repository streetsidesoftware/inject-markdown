import type { Html, Paragraph, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { DocumentValue, inlineText } from './builders.js';
import { detectMarkdownStyle } from './detectStyle.js';
import {
    blockNodes,
    describe,
    inlineNodes,
    isBlockContent,
    isKind,
    MarkdownValue,
    renderingOf,
    textNodes,
} from './nodes.js';
import { placeholderRegExp } from './placeholders.js';
import type { StyleOptions } from './render.js';
import type {
    InlineContent,
    MDBlockPlaceholder,
    MDFragment,
    MDInlineFragment,
    MDParagraph,
    MDPlaceholder,
    MDText,
    MDValue,
} from './types.js';

/** A value a template placeholder can take. */
export type TemplateValue = string | number | boolean | MDValue | readonly TemplateValue[];

/**
 * The values for a template.
 * - A top-level key may be a dotted name, such as `'engines.cspell'`.
 * - A nested object is walked one segment at a time.
 * - When several keys could supply a name, the later key wins.
 */
export interface TemplateValues {
    readonly [name: string]: TemplateValue | TemplateValues | undefined;
}

/**
 * Fill a Markdown template's `{@ name @}` placeholders.
 * - A string is inserted as text and escaped.
 * - A placeholder inside a line takes only inline values.
 * - A placeholder that is a whole line also takes blocks. Its paragraph splits around them.
 * - A placeholder inside inline code or a code block takes only a string or text, inserted as is.
 *
 * The filled result decides its kind:
 * - A single paragraph is inline, without the whitespace around it.
 * - Anything else is blocks, rendered in the template's own style.
 * @throws if a placeholder has no value, or a value doesn't fit where its placeholder is.
 */
export function template(markdown: string, values: TemplateValues): MDFragment | MDInlineFragment {
    const root = templateTree(markdown, false);
    throwIfMissing(fill(root, values, true));
    return fragment(root, markdown);
}

/**
 * Fill a Markdown template as blocks, the same way as {@link template}.
 * A single paragraph stays a paragraph.
 */
export function blockTemplate(markdown: string, values: TemplateValues): MDFragment {
    const root = templateTree(markdown, false);
    throwIfMissing(fill(root, values, true));
    return new MarkdownValue('block', 'a Markdown fragment', root.children, detectMarkdownStyle(root, markdown));
}

/**
 * Fill an inline template, for use inside a line.
 * The text must be one paragraph. Block syntax, such as a leading `-`, is read as text.
 * @throws if the text isn't one paragraph, a placeholder has no value, or a value isn't inline.
 */
export function inlineTemplate(markdown: string, values: TemplateValues): MDInlineFragment {
    const start = markdown.trimStart();
    const lead = markdown.slice(0, markdown.length - start.length);
    const body = start.trimEnd();
    const tail = start.slice(body.length);
    const root = templateTree(body, true);
    if (root.children.length > 1 || (root.children[0] && root.children[0].type !== 'paragraph')) {
        throw new Error('inline template text must be one paragraph');
    }
    throwIfMissing(fill(root, values, false));
    const children = root.children[0]?.type === 'paragraph' ? root.children[0].children : [];
    return new MarkdownValue('inline', 'an inline Markdown fragment', [
        ...textNodes(lead),
        ...children,
        ...textNodes(tail),
    ]);
}

/**
 * Markdown text as a value, for Markdown made elsewhere.
 * - A single paragraph is inline, without the whitespace around it.
 * - Anything else is blocks, rendered in the text's own style.
 *
 * A `{​@ name @​}` placeholder is kept as written, the same as in `text()`.
 */
export function parse(markdown: string): MDFragment | MDInlineFragment {
    const root = parseTree(markdown, false);
    keepPlaceholders(root);
    return fragment(root, markdown);
}

/**
 * What {@link substitutePlaceholders} returns for a value.
 * A value that can't hold what was substituted into it becomes a fragment of what it holds:
 * - Text with a value that isn't a string or text, or with blocks on a line of their own.
 * - An inline fragment or a paragraph with blocks on a line of their own.
 * - A placeholder with a value.
 */
export type SubstitutedValue<T extends MDValue> = T extends MDText
    ? MDText | MDInlineFragment | MDFragment
    : T extends MDInlineFragment
      ? MDInlineFragment | MDFragment
      : T extends MDParagraph
        ? MDParagraph | MDFragment
        : T extends MDPlaceholder
          ? MDPlaceholder | MDInlineFragment
          : T extends MDBlockPlaceholder
            ? MDBlockPlaceholder | MDFragment
            : T;

/**
 * Substitute values for the placeholders in a Markdown value.
 * - Values go in as in {@link template}.
 * - A placeholder with no value is kept as written, so it can be substituted later.
 * - The result is the same type of value, in the same style, when it can hold the values.
 *   Otherwise it's a fragment of the same kind, or blocks where a placeholder that is a whole line took blocks.
 * @throws if a value doesn't fit where its placeholder is.
 */
export function substitutePlaceholders<T extends MDValue>(value: T, values: TemplateValues): SubstitutedValue<T>;
export function substitutePlaceholders(value: MDValue, values: TemplateValues): MDValue {
    const rendering = renderingOf(value);
    if (!rendering) throw new TypeError(`expected a Markdown value, got ${describe(value)}`);
    const substituted = isText(value) ? substituteInText(value.text, values) : undefined;
    if (substituted !== undefined) return inlineText(substituted);
    const { style } = rendering;
    const nodes = structuredClone(rendering.nodes);
    switch (value.description) {
        case 'text':
        case 'an inline Markdown fragment':
            return fragmentOf(
                filled([{ type: 'paragraph', children: nodes as PhrasingContent[] }], values, true),
                style,
            );
        case 'a paragraph': {
            const root = filled(nodes, values, true);
            if (root.children.length === 1 && root.children[0].type === 'paragraph') {
                return new MarkdownValue('block', 'a paragraph', root.children, style);
            }
            return new MarkdownValue('block', 'a Markdown fragment', root.children, style);
        }
        case 'a placeholder':
        case 'a block placeholder': {
            if (resolveValue(values, (value as MDPlaceholder).name) === undefined) return value;
            const root = filled(nodes, values, value.kind === 'block');
            return value.kind === 'block'
                ? new MarkdownValue('block', 'a Markdown fragment', root.children, style)
                : new MarkdownValue('inline', 'an inline Markdown fragment', root.children, style);
        }
        case 'a document':
            return new DocumentValue(filled(nodes, values, true).children, style);
        default:
            return new MarkdownValue(
                value.kind,
                value.description,
                filled(nodes, values, value.kind !== 'inline').children,
                style,
            );
    }
}

/** A tree of nodes with the placeholders that have values replaced. */
function filled(nodes: RootContent[], values: TemplateValues, allowBlocks: boolean): Root {
    const root: Root = { type: 'root', children: nodes };
    fill(root, values, allowBlocks);
    return root;
}

/**
 * Text with its placeholders substituted, or `undefined` if a value isn't a string or text.
 * An escaped placeholder, or one with no value, is kept as written.
 */
function substituteInText(text: string, values: TemplateValues): string | undefined {
    let onlyText = true;
    const result = text.replace(placeholderRegExp, (whole, escape: string | undefined, name: string) => {
        const value = escape ? undefined : resolveValue(values, name);
        if (value === undefined) return whole;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (isText(value)) return value.text;
        onlyText = false;
        return whole;
    });
    return onlyText ? result : undefined;
}

/** A parsed tree as a value, in the style of its text. */
function fragment(root: Root, markdown: string): MDFragment | MDInlineFragment {
    return fragmentOf(root, detectMarkdownStyle(root, markdown));
}

/** A tree as a value. A single paragraph is inline, and anything else is blocks. */
function fragmentOf(root: Root, style: StyleOptions | undefined): MDFragment | MDInlineFragment {
    const [only, ...rest] = root.children;
    if (only?.type === 'paragraph' && !rest.length) {
        return new MarkdownValue('inline', 'an inline Markdown fragment', only.children, style);
    }
    return new MarkdownValue('block', 'a Markdown fragment', root.children, style);
}

/** Make the placeholders in text raw, in place, so rendering can't escape them. */
function keepPlaceholders(parent: Parent): void {
    parent.children = parent.children.flatMap((child): RootContent[] => {
        if (child.type === 'text') return textNodes(child.value);
        if ('children' in child) keepPlaceholders(child);
        return [child];
    });
}

/** A template's tree, with each placeholder in its text as a node of its own. */
function templateTree(markdown: string, inline: boolean): Root {
    const root = parseTree(markdown, inline);
    splitPlaceholders(root);
    return root;
}

/** Make the placeholders in text nodes of their own, in place. An escaped placeholder becomes text. */
function splitPlaceholders(parent: Parent): void {
    parent.children = parent.children.flatMap((child): RootContent[] => {
        if (child.type === 'text') return placeholderPieces(child.value);
        if ('children' in child) splitPlaceholders(child);
        return [child];
    });
}

function placeholderPieces(text: string): PhrasingContent[] {
    const nodes: PhrasingContent[] = [];
    let last = 0;
    for (const match of text.matchAll(placeholderRegExp)) {
        const [whole, escape] = match;
        if (match.index > last) nodes.push({ type: 'text', value: text.slice(last, match.index) });
        last = match.index + whole.length;
        nodes.push(escape ? { type: 'text', value: whole.slice(1) } : { type: 'html', value: whole });
    }
    if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
    return nodes;
}

/**
 * Block constructs, turned off when parsing an inline template.
 * The names are micromark's construct names.
 */
const blockConstructs = [
    'blockQuote',
    'codeFenced',
    'codeIndented',
    'definition',
    'gfmFootnoteDefinition',
    'headingAtx',
    'htmlFlow',
    'list',
    'setextUnderline',
    'table',
    'thematicBreak',
];

function parseTree(markdown: string, inline: boolean): Root {
    const processor = unified().use(remarkParse).use(remarkGfm);
    if (inline) {
        processor.use(function disableBlocks() {
            const data = this.data();
            (data.micromarkExtensions ??= []).push({ disable: { null: blockConstructs } });
        });
    }
    return processor.parse(markdown);
}

/**
 * Look up a placeholder name.
 * Each top-level key acts as a declaration, and the newest one wins:
 * - Keys are tried from last to first.
 * - A key matches when it equals the name, or a leading part of it whose rest resolves inside its value.
 * - A key that doesn't supply the name doesn't stop the search.
 */
export function resolveValue(values: TemplateValues, name: string): TemplateValue | undefined {
    const keys = Object.keys(values);
    for (let i = keys.length - 1; i >= 0; --i) {
        const key = keys[i];
        const value =
            key === name
                ? values[key]
                : name.startsWith(key + '.')
                  ? walk(values[key], name.slice(key.length + 1))
                  : undefined;
        if (isTemplateValue(value)) return value;
    }
    return undefined;
}

/** Walk a dotted name into nested objects, one segment per level. Only own properties count. */
function walk(value: unknown, name: string): unknown {
    let cur = value;
    for (const segment of name.split('.')) {
        if (!isPlainObject(cur) || !Object.hasOwn(cur, segment)) return undefined;
        cur = cur[segment];
    }
    return cur;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !renderingOf(value);
}

function isTemplateValue(value: unknown): value is TemplateValue {
    const t = typeof value;
    return (
        t === 'string' || t === 'number' || t === 'boolean' || renderingOf(value) !== undefined || Array.isArray(value)
    );
}

/** Blocks in place of a placeholder that is a whole line, until its paragraph is split around them. */
interface BlockSlot {
    readonly blocks: RootContent[];
}

type Piece = RootContent | BlockSlot;

/** Node types whose children may be blocks. */
const blockContainers = new Set(['blockquote', 'footnoteDefinition', 'list', 'listItem']);

/**
 * Replace the placeholders that have values, in place.
 * - A placeholder is an HTML node of its own. In code and other HTML, it's part of the text.
 * - Where blocks can go, a placeholder that is a whole line of a paragraph may take blocks.
 *   The paragraph splits around them.
 * - A placeholder made by `placeholder()` takes only inline content.
 * @param allowBlocks - the root's children may be blocks.
 * @returns the names that have no value.
 */
function fill(root: Root, values: TemplateValues, allowBlocks: boolean): Set<string> {
    const missing = new Set<string>();

    const lookup = (name: string): TemplateValue | undefined => {
        const value = resolveValue(values, name);
        if (value === undefined) missing.add(name);
        return value;
    };

    const fillCode = (code: string): string =>
        code.replace(placeholderRegExp, (whole, escape: string | undefined, name: string) => {
            if (escape) return whole.slice(1);
            const value = lookup(name);
            return value === undefined ? whole : valueAsCode(value, name);
        });

    /**
     * @param lines - the nodes are a paragraph's children, and a whole-line placeholder may take blocks.
     * @param blocks - the nodes may be blocks.
     */
    const fillNodes = (nodes: RootContent[], lines: boolean, blocks: boolean): Piece[] =>
        nodes.flatMap((node, i): Piece[] => {
            switch (node.type) {
                case 'paragraph': {
                    const pieces = fillNodes(node.children, blocks, false);
                    return splitParagraph(node, pieces);
                }
                case 'html': {
                    const name = keptPlaceholder(node);
                    if (!name) {
                        node.value = fillCode(node.value);
                        return [node];
                    }
                    const value = lookup(name);
                    if (value === undefined) return [node];
                    const takesBlocks = lines && !node.data?.inlinePlaceholder && isWholeLine(nodes, i);
                    if (takesBlocks && isBlockContent(value)) return [{ blocks: blockNodes(value, `{@ ${name} @}`) }];
                    return valueAsInline(value, name);
                }
                case 'inlineCode':
                case 'code':
                    node.value = fillCode(node.value);
                    return [node];
                default:
                    if ('children' in node) {
                        const children = fillNodes(node.children, false, blocks && blockContainers.has(node.type));
                        node.children = children as typeof node.children;
                    }
                    return [node];
            }
        });

    root.children = fillNodes(root.children, false, allowBlocks) as RootContent[];
    return missing;
}

/** A paragraph from its filled children, split around the blocks among them. */
function splitParagraph(paragraph: Paragraph, pieces: Piece[]): RootContent[] {
    if (!pieces.some(isBlockSlot)) {
        paragraph.children = pieces as PhrasingContent[];
        return [paragraph];
    }
    const result: RootContent[] = [];
    let line: PhrasingContent[] = [];
    const endParagraph = (): void => {
        const children = trimLine(line);
        if (children.length) result.push({ type: 'paragraph', children });
        line = [];
    };
    for (const piece of pieces) {
        if (!isBlockSlot(piece)) {
            line.push(piece as PhrasingContent);
            continue;
        }
        endParagraph();
        result.push(...piece.blocks);
    }
    endParagraph();
    return result;
}

function isBlockSlot(piece: Piece): piece is BlockSlot {
    return 'blocks' in piece;
}

/** Inline nodes without the line endings at their start and end. */
function trimLine(nodes: PhrasingContent[]): PhrasingContent[] {
    const result = nodes.filter((node, i) => node.type !== 'break' || (i > 0 && i < nodes.length - 1));
    const first = result[0];
    if (first?.type === 'text') result[0] = { ...first, value: first.value.replace(/^[ \t]*\r?\n/, '') };
    const last = result.at(-1);
    if (last?.type === 'text') result[result.length - 1] = { ...last, value: last.value.replace(/\r?\n[ \t]*$/, '') };
    return result.filter((node) => node.type !== 'text' || node.value);
}

/** Whether the node at `i` has nothing else on its line. */
function isWholeLine(nodes: readonly RootContent[], i: number): boolean {
    return endsLine(nodes[i - 1], /\n[ \t]*$/) && endsLine(nodes[i + 1], /^[ \t]*\r?\n/);
}

/** Whether a neighbor ends the line at its side: there is none, or it's a line break. */
function endsLine(node: RootContent | undefined, lineEnd: RegExp): boolean {
    return !node || node.type === 'break' || (node.type === 'text' && lineEnd.test(node.value));
}

/** The name of a placeholder kept as an HTML node of its own. */
function keptPlaceholder(node: Html): string | undefined {
    const matches = [...node.value.matchAll(placeholderRegExp)];
    const [whole, escape, name] = matches[0] ?? [];
    return matches.length === 1 && !escape && whole === node.value ? name : undefined;
}

function throwIfMissing(missing: Set<string>): void {
    if (!missing.size) return;
    const names = [...missing].map((name) => `{@ ${name} @}`).join(', ');
    throw new Error(`template has no value for ${names}`);
}

function valueAsInline(value: TemplateValue, name: string): PhrasingContent[] {
    if (typeof value === 'number' || typeof value === 'boolean') return textNodes(String(value));
    // A template value can be any kind. inlineNodes throws when it isn't inline.
    return inlineNodes(value as InlineContent, `{@ ${name} @}`);
}

/** A value inside code: only a string or text, inserted as is. */
function valueAsCode(value: TemplateValue, name: string): string {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (isText(value)) return value.text;
    if (isKind(value, 'inline') && value.description === 'a placeholder') return value.toString();
    throw new TypeError(`{@ ${name} @} is inside code and takes only a string or text, got ${describe(value)}`);
}

function isText(value: unknown): value is MDText {
    return isKind(value, 'inline') && value.description === 'text';
}

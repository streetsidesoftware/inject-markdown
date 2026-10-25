import type { ListItem, RootContent } from 'mdast';

import {
    blockNodes,
    describe,
    inlineNodes,
    isBlockContent,
    isKind,
    listItemNode,
    MarkdownValue,
    renderingOf,
    textNodes,
} from './nodes.js';
import { isValidPlaceholderName } from './placeholders.js';
import type { MarkdownStyle } from './style.js';

/**
 * What a value is, which decides where it may go:
 * - `inline`: inside a line.
 * - `block`: on its own lines.
 * - `comment`: either one.
 * - `listItem`: only directly in a list.
 */
export type MDKind = 'inline' | 'block' | 'comment' | 'listItem';

/** A Markdown value. Converting it to a string renders it. */
export interface MDValue {
    readonly kind: MDKind;
    /** What the value is, for error messages, such as `a list`. */
    readonly description: string;
    toString(): string;
}

/** Text. A `{@ name @}` placeholder in it is kept as written. */
export interface MDText extends MDValue {
    readonly kind: 'inline';
    readonly description: 'text';
    /** The text as written, unescaped. */
    readonly text: string;
}

export interface MDLink extends MDValue {
    readonly kind: 'inline';
    readonly description: 'a link';
}

export interface MDStrong extends MDValue {
    readonly kind: 'inline';
    readonly description: 'strong text';
}

export interface MDEmphasis extends MDValue {
    readonly kind: 'inline';
    readonly description: 'emphasized text';
}

export interface MDStrikethrough extends MDValue {
    readonly kind: 'inline';
    readonly description: 'struck-through text';
}

export interface MDInlineCode extends MDValue {
    readonly kind: 'inline';
    readonly description: 'inline code';
}

/** A line break in the form that works where it ends up. */
export interface MDLineBreak extends MDValue {
    readonly kind: 'inline';
    readonly description: 'a line break';
}

/** An HTML line break, `<br/>`. */
export interface MDBr extends MDValue {
    readonly kind: 'inline';
    readonly description: 'a <br/>';
}

export interface MDComment extends MDValue {
    readonly kind: 'comment';
    readonly description: 'a comment';
}

export interface MDHeading extends MDValue {
    readonly kind: 'block';
    readonly description: 'a heading';
}

export interface MDParagraph extends MDValue {
    readonly kind: 'block';
    readonly description: 'a paragraph';
}

export interface MDCodeBlock extends MDValue {
    readonly kind: 'block';
    readonly description: 'a code block';
}

export interface MDListItem extends MDValue {
    readonly kind: 'listItem';
    readonly description: 'a list item';
}

export interface MDList extends MDValue {
    readonly kind: 'block';
    readonly description: 'a list';
}

/** A whole document. It renders with a trailing newline, as a file should end. */
export interface MDDocument extends MDValue {
    readonly kind: 'block';
    readonly description: 'a document';
    /**
     * A copy of the document that renders in the given style.
     * The style replaces any style the document had. Everything inside the document renders in it.
     */
    withStyle(style: MarkdownStyle): MDDocument;
}

/** A filled block template: Markdown blocks, rendered in the template's own style. */
export interface MDBlockTemplate extends MDValue {
    readonly kind: 'block';
    readonly description: 'a block template';
}

/** A filled inline template. */
export interface MDInlineTemplate extends MDValue {
    readonly kind: 'inline';
    readonly description: 'an inline template';
}

class TextValue extends MarkdownValue<'inline', 'text'> implements MDText {
    constructor(readonly text: string) {
        super('inline', 'text', textNodes(text));
    }
}

class DocumentValue extends MarkdownValue<'block', 'a document'> implements MDDocument {
    constructor(nodes: RootContent[], style?: MarkdownStyle) {
        super('block', 'a document', nodes, style);
    }

    withStyle(style: MarkdownStyle): MDDocument {
        return new DocumentValue(renderingOf(this)?.nodes ?? [], style);
    }

    override toString(): string {
        return super.toString() + '\n';
    }
}

export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/** A value that goes inside a line. A comment goes either inside a line or on its own. */
export type MDInline =
    | MDText
    | MDLink
    | MDStrong
    | MDEmphasis
    | MDStrikethrough
    | MDInlineCode
    | MDLineBreak
    | MDBr
    | MDComment
    | MDInlineTemplate;

/** A value that goes on its own lines. */
export type MDBlock = MDHeading | MDParagraph | MDList | MDCodeBlock | MDComment | MDDocument | MDBlockTemplate;

/**
 * Content that goes inside a line:
 * - A string is text, and is escaped.
 * - An array is a sequence. Its pieces are joined as given, with no added spaces.
 */
export type InlineContent = string | MDInline | readonly InlineContent[];

/** Content on its own lines. An array is a sequence of blocks. */
export type BlockContent = MDBlock | readonly BlockContent[];

/** A piece of a list item. Inline pieces in a row form a line, and blocks follow on their own lines. */
export type ListItemContent = InlineContent | BlockContent;

/**
 * One item of a list:
 * - A string, inline value, or block is a whole item.
 * - An array is one item holding a sequence, the same as {@link listItem}.
 */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

/** Whether a value is one of the Markdown values. */
export function isMarkdown(value: unknown): value is MDValue {
    return renderingOf(value) !== undefined;
}

/**
 * Comment text that can't end the comment early.
 * HTML ends a comment at `-->` or `--!>`.
 */
function commentSafe(text: string): string {
    return text.replace(/--(!?)>/g, '-- $1>');
}

/** Text. A string `{@ name @}` placeholder in it is kept as written. */
export function text(value: string): MDText {
    return new TextValue(value);
}

/**
 * A `{@ name @}` placeholder, rendered exactly as written so it can be filled at injection time.
 * It is text, so it is also accepted inside code.
 */
export function placeholder(name: string): MDText {
    if (!isValidPlaceholderName(name)) throw new Error(`invalid placeholder name: "${name}"`);
    return new TextValue(`{@ ${name} @}`);
}

/** A link, `[content](url)`. */
export function link(content: InlineContent, url: string | URL): MDLink {
    const href = typeof url === 'string' ? url : url.href;
    return new MarkdownValue('inline', 'a link', [
        { type: 'link', url: href, children: inlineNodes(content, 'link content') },
    ]);
}

/** Strong text, `**content**`. */
export function strong(content: InlineContent): MDStrong {
    return new MarkdownValue('inline', 'strong text', [
        { type: 'strong', children: inlineNodes(content, 'strong content') },
    ]);
}

/** Emphasized text, `_content_`. */
export function emphasis(content: InlineContent): MDEmphasis {
    return new MarkdownValue('inline', 'emphasized text', [
        { type: 'emphasis', children: inlineNodes(content, 'emphasis content') },
    ]);
}

/** Struck-through text, `~~content~~`. */
export function strikethrough(content: InlineContent): MDStrikethrough {
    return new MarkdownValue('inline', 'struck-through text', [
        { type: 'delete', children: inlineNodes(content, 'strikethrough content') },
    ]);
}

/** Inline code. The code is inserted as is. */
export function inlineCode(code: string): MDInlineCode {
    return new MarkdownValue('inline', 'inline code', [{ type: 'inlineCode', value: code }]);
}

/**
 * A line break in the form that works where it ends up.
 * In a paragraph or list item it's a Markdown hard break, a `\` at the end of the line.
 */
export function lineBreak(): MDLineBreak {
    return new MarkdownValue('inline', 'a line break', [{ type: 'break' }]);
}

/** An HTML line break, always `<br/>`. It's self-closed, so it also works in MDX. */
export function br(): MDBr {
    return new MarkdownValue('inline', 'a <br/>', [{ type: 'html', value: '<br/>' }]);
}

/** An HTML comment, `<!-- text -->`. It goes inside a line or on its own. */
export function comment(text: string): MDComment {
    return new MarkdownValue('comment', 'a comment', [{ type: 'html', value: `<!-- ${commentSafe(text)} -->` }]);
}

/** A heading, `## content`. */
export function heading(depth: HeadingDepth, content: InlineContent): MDHeading {
    if (!Number.isInteger(depth) || depth < 1 || depth > 6) {
        throw new Error(`heading depth must be 1 to 6, got ${String(depth)}`);
    }
    return new MarkdownValue('block', 'a heading', [
        { type: 'heading', depth, children: inlineNodes(content, 'heading content') },
    ]);
}

/** A paragraph: inline content as a block. */
export function paragraph(...content: InlineContent[]): MDParagraph {
    return paragraphOf(content, 'paragraph content');
}

function paragraphOf(content: readonly InlineContent[], where: string): MDParagraph {
    return new MarkdownValue('block', 'a paragraph', [{ type: 'paragraph', children: inlineNodes(content, where) }]);
}

/**
 * Content as blocks, for where only blocks can go.
 * - Blocks are returned unchanged.
 * - Each run of inline pieces becomes a paragraph, as in a list item.
 */
export function toBlock(content: ListItemContent | readonly ListItemContent[]): BlockContent {
    if (isBlockContent(content)) return content as BlockContent;
    const blocks: BlockContent[] = [];
    let line: InlineContent[] = [];
    const endLine = () => {
        if (line.length) blocks.push(paragraphOf(line, 'block content'));
        line = [];
    };
    const add = (piece: unknown) => {
        if (Array.isArray(piece)) return piece.forEach(add);
        if (isBlockContent(piece)) {
            endLine();
            blocks.push(piece as BlockContent);
            return;
        }
        line.push(piece as InlineContent);
    };
    add(content);
    endLine();
    return blocks.length === 1 ? blocks[0] : blocks;
}

/** A fenced code block. The code is inserted as is. */
export function codeBlock(code: string, lang?: string): MDCodeBlock {
    return new MarkdownValue('block', 'a code block', [{ type: 'code', lang: lang || null, value: code }]);
}

/** One list item from several pieces, for use in {@link list}. */
export function listItem(...content: ListItemContent[]): MDListItem {
    return new MarkdownValue('listItem', 'a list item', [listItemNode(content)]);
}

/** A whole document from blocks. Arrays of blocks are flattened. */
export function document(...content: BlockContent[]): MDDocument {
    return new DocumentValue(blockNodes(content, 'document content'));
}

/** A bulleted list, one item per entry. */
export function list(entries: readonly ListEntry[]): MDList {
    if (!Array.isArray(entries)) throw new TypeError(`list entries must be an array, got ${describe(entries)}`);
    const items = entries.map((entry) =>
        isKind(entry, 'listItem')
            ? (renderingOf(entry)?.nodes[0] as ListItem)
            : listItemNode(Array.isArray(entry) ? entry : [entry]),
    );
    return new MarkdownValue('block', 'a list', [{ type: 'list', ordered: false, spread: false, children: items }]);
}

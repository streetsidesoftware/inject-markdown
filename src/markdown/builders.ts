import type { ListItem, PhrasingContent } from 'mdast';

import { blockNodes, describe, inlineNodes, isKind, listItemNode, renderingOf, setNodes, textNodes } from './nodes.js';
import { isValidPlaceholderName } from './placeholders.js';
import { renderNodes } from './render.js';

/**
 * What a value is, which decides where it may go:
 * - `inline`: inside a line.
 * - `block`: on its own lines.
 * - `comment`: either one.
 * - `listItem`: only directly in a list.
 */
export type MDKind = 'inline' | 'block' | 'comment' | 'listItem';

/** A Markdown value. Converting it to a string renders it. */
export abstract class MDValue {
    abstract readonly kind: MDKind;
    /** What the value is, for error messages, such as `a list`. */
    abstract readonly description: string;

    toString(): string {
        const { nodes, style } = renderingOf(this) ?? { nodes: [], style: undefined };
        if (this.kind === 'inline') {
            return renderNodes([{ type: 'paragraph', children: nodes as PhrasingContent[] }], style);
        }
        if (this.kind === 'listItem') {
            return renderNodes([{ type: 'list', ordered: false, spread: false, children: nodes as ListItem[] }], style);
        }
        return renderNodes(nodes, style);
    }
}

/** Text. A `{@ name @}` placeholder in it is kept as written. */
export class MDText extends MDValue {
    readonly kind = 'inline';
    readonly description = 'text';

    /** @param text - the text as written, unescaped. */
    constructor(readonly text: string) {
        super();
        setNodes(this, textNodes(text));
    }
}

export class MDLink extends MDValue {
    readonly kind = 'inline';
    readonly description = 'a link';

    constructor(content: InlineContent, url: string | URL) {
        const href = typeof url === 'string' ? url : url.href;
        super();
        setNodes(this, [{ type: 'link', url: href, children: inlineNodes(content, 'link content') }]);
    }
}

export class MDInlineCode extends MDValue {
    readonly kind = 'inline';
    readonly description = 'inline code';

    constructor(code: string) {
        super();
        setNodes(this, [{ type: 'inlineCode', value: code }]);
    }
}

export class MDComment extends MDValue {
    readonly kind = 'comment';
    readonly description = 'a comment';

    constructor(text: string) {
        super();
        setNodes(this, [{ type: 'html', value: `<!-- ${commentSafe(text)} -->` }]);
    }
}

export class MDHeading extends MDValue {
    readonly kind = 'block';
    readonly description = 'a heading';

    constructor(depth: HeadingDepth, content: InlineContent) {
        if (!Number.isInteger(depth) || depth < 1 || depth > 6) {
            throw new Error(`heading depth must be 1 to 6, got ${String(depth)}`);
        }
        super();
        setNodes(this, [{ type: 'heading', depth, children: inlineNodes(content, 'heading content') }]);
    }
}

export class MDParagraph extends MDValue {
    readonly kind = 'block';
    readonly description = 'a paragraph';

    constructor(content: InlineContent) {
        super();
        setNodes(this, [{ type: 'paragraph', children: inlineNodes(content, 'paragraph content') }]);
    }
}

export class MDCodeBlock extends MDValue {
    readonly kind = 'block';
    readonly description = 'a code block';

    constructor(code: string, lang?: string) {
        super();
        setNodes(this, [{ type: 'code', lang: lang || null, value: code }]);
    }
}

export class MDListItem extends MDValue {
    readonly kind = 'listItem';
    readonly description = 'a list item';

    constructor(content: readonly ListItemContent[]) {
        super();
        setNodes(this, [listItemNode(content)]);
    }
}

export class MDList extends MDValue {
    readonly kind = 'block';
    readonly description = 'a list';

    constructor(entries: readonly ListEntry[]) {
        if (!Array.isArray(entries)) throw new TypeError(`list entries must be an array, got ${describe(entries)}`);
        super();
        const items = entries.map((entry) =>
            isKind(entry, 'listItem')
                ? (renderingOf(entry)?.nodes[0] as ListItem)
                : listItemNode(Array.isArray(entry) ? entry : [entry]),
        );
        setNodes(this, [{ type: 'list', ordered: false, spread: false, children: items }]);
    }
}

/** A whole document. It renders with a trailing newline, as a file should end. */
export class MDDocument extends MDValue {
    readonly kind = 'block';
    readonly description = 'a document';

    constructor(content: readonly BlockContent[]) {
        super();
        setNodes(this, blockNodes(content, 'document content'));
    }

    override toString(): string {
        return super.toString() + '\n';
    }
}

/** A filled template: Markdown blocks, rendered in the template's own style. */
export class MDTemplate extends MDValue {
    readonly kind = 'block';
    readonly description = 'a template';
}

/** A filled inline template. */
export class MDInlineTemplate extends MDValue {
    readonly kind = 'inline';
    readonly description = 'an inline template';
}

export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

/** A value that goes inside a line. A comment goes either inside a line or on its own. */
export type MDInline = MDText | MDLink | MDInlineCode | MDComment | MDInlineTemplate;

/** A value that goes on its own lines. */
export type MDBlock = MDHeading | MDParagraph | MDList | MDCodeBlock | MDComment | MDDocument | MDTemplate;

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
    return new MDText(value);
}

/**
 * A `{@ name @}` placeholder, rendered exactly as written so it can be filled at injection time.
 * It is text, so it is also accepted inside code.
 */
export function placeholder(name: string): MDText {
    if (!isValidPlaceholderName(name)) throw new Error(`invalid placeholder name: "${name}"`);
    return new MDText(`{@ ${name} @}`);
}

/** A link, `[content](url)`. */
export function link(content: InlineContent, url: string | URL): MDLink {
    return new MDLink(content, url);
}

/** Inline code. The code is inserted as is. */
export function inlineCode(code: string): MDInlineCode {
    return new MDInlineCode(code);
}

/** An HTML comment, `<!-- text -->`. It goes inside a line or on its own. */
export function comment(text: string): MDComment {
    return new MDComment(text);
}

/** A heading, `## content`. */
export function heading(depth: HeadingDepth, content: InlineContent): MDHeading {
    return new MDHeading(depth, content);
}

/** A paragraph: inline content as a block. */
export function paragraph(...content: InlineContent[]): MDParagraph {
    return new MDParagraph(content);
}

/** A fenced code block. The code is inserted as is. */
export function codeBlock(code: string, lang?: string): MDCodeBlock {
    return new MDCodeBlock(code, lang);
}

/** One list item from several pieces, for use in {@link list}. */
export function listItem(...content: ListItemContent[]): MDListItem {
    return new MDListItem(content);
}

/** A whole document from blocks. Arrays of blocks are flattened. */
export function document(...content: BlockContent[]): MDDocument {
    return new MDDocument(content);
}

/** A bulleted list, one item per entry. */
export function list(entries: readonly ListEntry[]): MDList {
    return new MDList(entries);
}

import type { ListItem, Paragraph, RootContent } from 'mdast';

import {
    describe,
    groupedNodes,
    inlineNodes,
    isArray,
    isBlockContent,
    isListItem,
    listItemNode,
    MarkdownValue,
    placeholderNode,
    renderingOf,
    runs,
    textNodes,
} from './nodes.js';
import { isValidPlaceholderName } from './placeholders.js';
import type { StyleOptions } from './render.js';
import type {
    AnyContent,
    BlockContent,
    HeadingDepth,
    InlineContent,
    ListEntry,
    ListItemContent,
    MarkdownStyle,
    MDBlockPlaceholder,
    MDBr,
    MDCodeBlock,
    MDComment,
    MDDocument,
    MDEmphasis,
    MDFragment,
    MDHeading,
    MDInlineCode,
    MDLineBreak,
    MDLink,
    MDList,
    MDListItem,
    MDParagraph,
    MDPlaceholder,
    MDStrikethrough,
    MDStrong,
    MDText,
    MDValue,
} from './types.js';

class TextValue extends MarkdownValue<'inline', 'text'> implements MDText {
    constructor(readonly text: string) {
        super('inline', 'text', textNodes(text));
    }
}

class PlaceholderValue extends MarkdownValue<'inline', 'a placeholder'> implements MDPlaceholder {
    constructor(readonly name: string) {
        super('inline', 'a placeholder', [placeholderNode(name, true)]);
    }
}

class BlockPlaceholderValue extends MarkdownValue<'block', 'a block placeholder'> implements MDBlockPlaceholder {
    constructor(readonly name: string) {
        super('block', 'a block placeholder', [{ type: 'paragraph', children: [placeholderNode(name)] }]);
    }
}

export class DocumentValue extends MarkdownValue<'block', 'a document'> implements MDDocument {
    constructor(nodes: RootContent[], style?: StyleOptions) {
        super('block', 'a document', nodes, style);
    }

    withStyle(style: MarkdownStyle): MDDocument {
        return new DocumentValue(renderingOf(this)?.nodes ?? [], style);
    }

    override toString(): string {
        return super.toString() + '\n';
    }
}

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

/**
 * Text, for use inside a line. A `{​@ name @​}` placeholder in it is kept as written.
 * A newline stays in the text, and displays as a space.
 */
export function inlineText(value: string): MDText {
    return new TextValue(value);
}

/** The same as {@link inlineText}. */
export const text = inlineText;

/**
 * Plain text as paragraphs.
 * - A blank line, or a line of only spaces and tabs, ends a paragraph.
 * - Other lines are escaped, as in {@link inlineText}, and a newline between them displays as a space.
 * - Blank lines at the start and end are dropped.
 */
export function blockText(value: string): MDFragment {
    const paragraphs: Paragraph[] = [];
    let lines: string[] = [];
    const endParagraph = (): void => {
        if (lines.length) paragraphs.push({ type: 'paragraph', children: textNodes(lines.join('\n')) });
        lines = [];
    };
    for (const line of value.split(/\r\n?|\n/)) {
        if (/^[ \t]*$/.test(line)) {
            endParagraph();
            continue;
        }
        lines.push(line);
    }
    endParagraph();
    return new MarkdownValue('block', 'a Markdown fragment', paragraphs);
}

/**
 * A `{​@ name @​}` placeholder for use inside a line, rendered exactly as written so it can be filled later.
 * It takes only inline content. It is also accepted inside code.
 */
export function placeholder(name: string): MDPlaceholder {
    checkPlaceholderName(name);
    return new PlaceholderValue(name);
}

/**
 * A `{​@ name @​}` placeholder on its own lines, rendered exactly as written so it can be filled later.
 * It takes blocks or inline content.
 */
export function blockPlaceholder(name: string): MDBlockPlaceholder {
    checkPlaceholderName(name);
    return new BlockPlaceholderValue(name);
}

function checkPlaceholderName(name: string): void {
    if (!isValidPlaceholderName(name)) throw new Error(`invalid placeholder name: "${name}"`);
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
export function toBlock(content: AnyContent): BlockContent {
    if (isBlockContent(content)) return content;
    const blocks = runs(content).map((run) => ('inline' in run ? paragraphOf(run.inline, 'block content') : run.block));
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

/**
 * A whole document. Arrays are flattened.
 * Inline pieces in a row form a paragraph, and blocks follow, as in a list item.
 */
export function document(...content: AnyContent[]): MDDocument {
    return new DocumentValue(groupedNodes(content, 'document content'));
}

/** A bulleted list, one item per entry. */
export function list(entries: readonly ListEntry[]): MDList {
    if (!Array.isArray(entries)) throw new TypeError(`list entries must be an array, got ${describe(entries)}`);
    const items = entries.map((entry) =>
        isListItem(entry) ? (renderingOf(entry)?.nodes[0] as ListItem) : listItemNode(isArray(entry) ? entry : [entry]),
    );
    return new MarkdownValue('block', 'a list', [{ type: 'list', ordered: false, spread: false, children: items }]);
}

/** The public types of the Markdown builders. This module imports nothing, so every other module can depend on it. */

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

/** Content that can be either a block or inline. */
export type BlockOrInlineContent = InlineContent | BlockContent;

/** Block or inline content, or an array that mixes them. */
export type AnyContent = BlockOrInlineContent | readonly BlockOrInlineContent[];

/** A piece of a list item. Inline pieces in a row form a line, and blocks follow on their own lines. */
export type ListItemContent = BlockOrInlineContent;

/**
 * One item of a list:
 * - A string, inline value, or block becomes one item.
 * - An array also becomes one item, never a nested list. Its pieces are joined into that item:
 *   `['See ', link('the docs', url)]` becomes `- See [the docs](url)`.
 */
export type ListEntry = InlineContent | MDBlock | MDListItem | readonly ListItemContent[];

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

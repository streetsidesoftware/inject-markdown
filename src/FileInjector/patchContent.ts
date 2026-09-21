import type { Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify';
import { unified } from 'unified';

/** A character-offset (string index, not byte offset) splice into the original source text. */
export interface Patch {
    /** character offset into the original source (inclusive) */
    start: number;
    /** character offset into the original source (exclusive) */
    end: number;
    /** replacement text, already using the file's line ending */
    text: string;
}

/**
 * Apply non-overlapping, document-ordered patches to `content`, leaving
 * everything outside the patched spans untouched.
 */
export function applyPatches(content: string, patches: Patch[]): string {
    let cursor = 0;
    let result = '';
    for (const patch of patches) {
        result += content.slice(cursor, patch.start) + patch.text;
        cursor = patch.end;
    }
    result += content.slice(cursor);
    return result;
}

/**
 * Stringify a fragment of nodes in isolation (not the whole document), for
 * splicing into an otherwise-untouched source string.
 *
 * Includes `remarkGfm` so `@@inject-table` nodes stringify correctly.
 * Strips the trailing newline(s) `remark-stringify` appends for a root,
 * since the surrounding original text already supplies that whitespace.
 */
export function stringifyFragment(nodes: RootContent[], outputOptions: StringifyOptions, lineEnding: string): string {
    const root: Root = { type: 'root', children: nodes };
    const markdown = unified().use(remarkGfm).use(remarkStringify, outputOptions).stringify(root);
    const trimmed = markdown.replace(/\n+$/, '');
    return lineEnding === '\n' ? trimmed : trimmed.replace(/\n/g, lineEnding);
}

/**
 * The literal text preceding `offset` on its own source line: indentation,
 * a blockquote `> `, a list marker's continuation width, etc.
 */
export function lineIndent(content: string, offset: number): string {
    const lineStart = content.lastIndexOf('\n', offset - 1) + 1;
    return content.slice(lineStart, offset);
}

/**
 * Prefix every line but the first with `indent`, so a fragment spliced back
 * into a container that relies on a per-line prefix (a list item, a
 * blockquote) stays nested inside it. The first line is left alone because
 * it's glued directly after the original prefix text, which is untouched;
 * every later line needs that prefix reconstructed, since the whole span
 * between the directives — prefixes included — was replaced.
 */
export function indentContinuationLines(text: string, indent: string): string {
    if (!indent) return text;
    return text
        .split('\n')
        .map((line, i) => (i === 0 ? line : indent + line))
        .join('\n');
}

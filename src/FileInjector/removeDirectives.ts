import { visit } from 'unist-util-visit';

import { isDirectiveComment, markdownParser } from './Markdown.js';
import { applyPatches, type Patch } from './patchContent.js';

/**
 * Remove every `@@inject` directive comment from Markdown.
 * Everything else, including injected content, stays exactly as written.
 *
 * Around a removed comment:
 * - A comment alone on its lines takes those lines with it.
 * - If that leaves two blank lines in a row, one of them goes too.
 * - At the start or end of the text, a blank line left next to it goes too.
 * - A comment inside a line of text only loses its own text.
 */
export function removeDirectives(markdown: string): string {
    const root = markdownParser(markdown).parse(markdown);
    const patches: Patch[] = [];
    visit(root, isDirectiveComment, (node) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (start === undefined || end === undefined) return;
        patches.push(removalPatch(markdown, start, end));
    });
    const text = applyPatches(markdown, patches);
    return lineCuts(markdown, patches).reduceRight(tidyBlankLines, text);
}

/** The comment's own text, or its whole lines when it is alone on them. */
function removalPatch(text: string, start: number, end: number): Patch {
    const lineStart = startOfLine(text, start);
    const lineEnd = endOfLine(text, end);
    const aloneOnItsLines = isBlank(text.slice(lineStart, start)) && isBlank(text.slice(end, lineEnd));
    return aloneOnItsLines ? { start: lineStart, end: lineEnd, text: '' } : { start, end, text: '' };
}

/**
 * Where whole lines were cut, as offsets into the result.
 * Adjacent cuts land on the same offset and count once.
 */
function lineCuts(markdown: string, patches: Patch[]): number[] {
    const cuts: number[] = [];
    let removed = 0;
    for (const patch of patches) {
        const cut = patch.start - removed;
        removed += patch.end - patch.start;
        if (!isWholeLines(markdown, patch)) continue;
        if (cuts.at(-1) === cut) continue;
        cuts.push(cut);
    }
    return cuts;
}

function isWholeLines(text: string, patch: Patch): boolean {
    return patch.start === startOfLine(text, patch.start) && patch.end === endOfLine(text, patch.end - 1);
}

/** Remove a blank line that the cut at `offset` leaves where it isn't wanted. */
function tidyBlankLines(text: string, offset: number): string {
    const nextEnd = endOfLine(text, offset);
    const nextBlank = offset < text.length && isBlank(text.slice(offset, nextEnd));
    if (offset === 0) return nextBlank ? text.slice(nextEnd) : text;

    const previousStart = startOfLine(text, offset - 1);
    const previousBlank = isBlank(text.slice(previousStart, offset));
    if (previousBlank && nextBlank) {
        return text.slice(0, offset) + text.slice(nextEnd);
    }
    const atEnd = offset >= text.length;
    if (previousBlank && atEnd && previousStart > 0) {
        return text.slice(0, previousStart);
    }
    return text;
}

/** The offset where the line containing `offset` starts. */
function startOfLine(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

/** The offset just past the line that contains `offset`, including its line break. */
function endOfLine(text: string, offset: number): number {
    const newline = text.indexOf('\n', offset);
    return newline < 0 ? text.length : newline + 1;
}

function isBlank(text: string): boolean {
    return !text.trim();
}

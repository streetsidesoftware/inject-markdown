import type { Root } from 'mdast';
import type { Options } from 'remark-stringify';
import { visit } from 'unist-util-visit';

/**
 * Detects the Markdown marker style (bullets, emphasis, fences, etc.) `root`
 * actually uses, by majority vote over its nodes, so re-stringifying can
 * preserve it instead of falling back to remark-stringify's defaults.
 */
export function detectMarkdownStyle(root: Root, content: string): Options {
    const rule = new Tally<'-' | '_' | '*'>();
    const bullet = new Tally<'-' | '+' | '*'>();
    const bulletOrdered = new Tally<'.' | ')'>();
    const emphasis = new Tally<'_' | '*'>();
    const strong = new Tally<'_' | '*'>();
    const fence = new Tally<'`' | '~'>();

    visit(root, (node) => {
        const offset = node.position?.start.offset;
        if (offset === undefined) return;

        switch (node.type) {
            case 'thematicBreak':
                rule.add(charAt(firstNonSpace(content, offset)));
                break;
            case 'list': {
                const first = node.children[0];
                const firstOffset = first?.position?.start.offset;
                if (firstOffset === undefined) break;
                if (node.ordered) {
                    bulletOrdered.add(charAt(orderedMarkerAt(content, firstOffset)));
                } else {
                    bullet.add(charAt(firstNonSpace(content, firstOffset)));
                }
                break;
            }
            case 'emphasis':
                emphasis.add(charAt(content[offset]));
                break;
            case 'strong':
                strong.add(charAt(content[offset]));
                break;
            case 'code': {
                const marker = content.slice(offset, offset + 3);
                if (marker.startsWith('```')) fence.add('`');
                else if (marker.startsWith('~~~')) fence.add('~');
                break;
            }
        }
    });

    const options: Options = {
        bullet: bullet.winner() ?? '-',
        emphasis: emphasis.winner() ?? '_',
        fence: fence.winner() ?? '`',
        fences: true,
        incrementListMarker: false,
        rule: rule.winner() ?? '-',
        strong: strong.winner() ?? '*',
    };
    const ordered = bulletOrdered.winner();
    if (ordered) options.bulletOrdered = ordered;

    return options;
}

/**
 * Exported for direct testing: `mdast-util-from-markdown` always offsets
 * nodes at the marker itself, not preceding indentation, so this
 * whitespace-skipping isn't reachable via `detectMarkdownStyle` today.
 */
export function firstNonSpace(content: string, offset: number): string | undefined {
    let i = offset;
    while (i < content.length && (content[i] === ' ' || content[i] === '\t')) ++i;
    return content[i];
}

/** See {@link firstNonSpace}. */
export function orderedMarkerAt(content: string, offset: number): string | undefined {
    let i = offset;
    while (i < content.length && (content[i] === ' ' || content[i] === '\t')) ++i;
    while (i < content.length && /[0-9]/.test(content[i])) ++i;
    return content[i];
}

function charAt<T extends string>(c: string | undefined): T | undefined {
    return c as T | undefined;
}

/** Counts votes for candidate marker characters and reports the most common. */
class Tally<T extends string> {
    private counts = new Map<T, number>();

    add(value: T | undefined): void {
        if (value === undefined) return;
        this.counts.set(value, (this.counts.get(value) ?? 0) + 1);
    }

    winner(): T | undefined {
        let best: T | undefined;
        let bestCount = 0;
        for (const [value, count] of this.counts) {
            if (count > bestCount) {
                best = value;
                bestCount = count;
            }
        }
        return best;
    }
}

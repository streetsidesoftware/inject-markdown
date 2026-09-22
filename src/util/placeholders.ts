import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Matches `{@ name @}` placeholders (ADR-0001), with an optional leading backslash escape.
 * Whitespace immediately inside the delimiters is optional and trimmed by the regex itself.
 */
const placeholderRegExp = /(\\)?\{@\s*([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\s*@\}/g;

export type PlaceholderResolver = (name: string) => string | undefined;

/**
 * Replace placeholders in a single string. `\{@ ... @}` is unescaped to literal `{@ ... @}` text.
 * An unresolved name is left untouched and reported via `onUnresolved` (once per occurrence — the
 * caller is responsible for deduping per directive, per ADR-0005).
 */
export function substituteInString(
    text: string,
    resolve: PlaceholderResolver,
    onUnresolved: (name: string) => void,
): string {
    return text.replace(placeholderRegExp, (match, escape: string | undefined, name: string) => {
        if (escape) return match.slice(1);
        const value = resolve(name);
        if (value === undefined) {
            onUnresolved(name);
            return match;
        }
        return value;
    });
}

/** Text-bearing mdast node types eligible for substitution, per ADR-0006 point 2. */
const textBearingTypes = ['text', 'inlineCode', 'code', 'html'] as const;

/**
 * Walk a markdown subtree's text-bearing nodes and substitute placeholders within each node's
 * own string value, in place. Does not stringify/re-parse the tree, per ADR-0006 point 2.
 */
export function substituteInTree(root: Root, resolve: PlaceholderResolver, onUnresolved: (name: string) => void): void {
    visit(root, [...textBearingTypes], (node) => {
        node.value = substituteInString(node.value, resolve, onUnresolved);
    });
}

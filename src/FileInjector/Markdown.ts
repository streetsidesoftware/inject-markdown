import type { BlockContent, Code, DefinitionContent, Heading, Html, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { is } from 'unist-util-is';
import { remove } from 'unist-util-remove';

import { directiveRegExp } from './Directive.js';

/**
 * Wrap content into a `root` node, unless it already is one.
 */
export function toRoot(content: Root | RootContent | RootContent[]): Root {
    if (!Array.isArray(content) && content.type === 'root') return content;
    const children = Array.isArray(content) ? content : [content];
    return {
        type: 'root',
        children,
    };
}

/**
 * Generate a code block node from a language and content.
 */
export function toCode(lang: string, content: string | RootContent | Root): Code {
    const value = contentToString(content).trim();

    return {
        type: 'code',
        lang,
        value,
    };
}

/**
 * Wrap a root's content in a blockquote, if requested.
 */
export function applyQuote(root: Root, makeIntoQuote: boolean): Root {
    if (!makeIntoQuote) return root;
    return toRoot({ type: 'blockquote', children: filterChildren(root.children) });
}

function filterChildren(children: RootContent[]): (BlockContent | DefinitionContent)[] {
    return children.filter(filterContent);
}

function filterContent(c: RootContent): c is BlockContent | DefinitionContent {
    return c.type !== 'yaml';
}

/**
 * Stringify a node/root/string back into Markdown.
 */
export function contentToString(content: RootContent | Root | string): string {
    if (typeof content === 'string') return content;
    const root = toRoot(content);
    const md = unified().use(remarkStringify).stringify(root);
    return md;
}

function headingString(n: Heading): string {
    return contentToString(n);
}

/**
 * Extract the section of a root under a matching heading, if given.
 */
export function extractHeader(root: Root, header: string | undefined): Root {
    if (!header) return root;

    function normalizeHeader(h: string): string {
        return h.toLowerCase().replace(/[-_\s#`*]/g, '');
    }

    const searchFor = normalizeHeader(header);
    const children = root.children;
    const foundIdx = children.findIndex(
        (n: RootContent) => isHeadingNode(n) && normalizeHeader(headingString(n)) === searchFor,
    );
    const found = root.children[foundIdx];
    if (!found || !isHeadingNode(found)) {
        return toRoot({
            type: 'html',
            value: `<!--- header: "${header}" not found.  --->`,
        });
    }

    const nodes: RootContent[] = [found];

    const depth = found.depth;

    for (let i = foundIdx + 1; i < children.length; ++i) {
        const n = children[i];
        if (isHeadingNode(n) && n.depth <= depth) {
            break;
        }
        nodes.push(n);
    }

    return toRoot(nodes);
}

/**
 * Remove any `@@inject` directive comments from an imported tree
 * so nested directives are not re-processed.
 */
export function sanitizeImport(root: Root): Root {
    remove(root, (n) => isHtmlNode(n) && directiveRegExp.test(n.value));
    return root;
}

/**
 * Render an error as an HTML comment node so it is visible in the output.
 */
export function errorToComment(err: Error): Root {
    const msg = (err.message || err.toString()).split('\n').join('\n  ');
    return unified().use(remarkParse).use(remarkGfm).parse(`\
<!---
  ${msg}
--->`);
}

export function isHtmlNode(n: unknown): n is Html {
    return is(n, 'html');
}

export function isHeadingNode(n: unknown): n is Heading {
    return is(n, 'heading');
}

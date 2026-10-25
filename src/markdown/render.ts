import type { Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify, { type Options as StyleOptions } from 'remark-stringify';
import { unified } from 'unified';

export type { Options as StyleOptions } from 'remark-stringify';

/** The style for constructs a value carries no style for. */
export const defaultStyle: StyleOptions = {
    bullet: '-',
    emphasis: '_',
    fence: '`',
    fences: true,
    incrementListMarker: false,
    rule: '-',
    strong: '*',
};

/**
 * Render Markdown nodes as text, without a trailing newline.
 * Escaping is left to remark, which knows where each node sits.
 */
export function renderNodes(children: RootContent[], style: StyleOptions | undefined): string {
    const root: Root = { type: 'root', children };
    // A field set to `undefined` keeps the default, rather than falling back to remark's own default.
    const given = Object.entries(style ?? {}).filter(([, value]) => value !== undefined);
    const md = unified()
        .use(remarkGfm)
        .use(remarkStringify, { ...defaultStyle, ...Object.fromEntries(given) })
        .stringify(root);
    return md.replace(/\n$/, '');
}

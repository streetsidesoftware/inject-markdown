import { posix } from 'node:path';

import type { Nodes } from 'mdast';
import { visit } from 'unist-util-visit';

const schemeRegExp = /^[a-z][a-z\d+.-]*:/i;

/**
 * Is `url` path-relative: no scheme and not starting with `/` or `#`.
 * See docs/ADRs/relative-links/0001-rebase-scope.md point 3.
 */
export function isPathRelativeUrl(url: string): boolean {
    return !!url && !schemeRegExp.test(url) && !url.startsWith('/') && !url.startsWith('#');
}

/**
 * Rewrite `url`, written relative to `sourceUrl`, so it resolves the same from `hostUrl`.
 * Returns `url` unchanged when it isn't path-relative or both files share a directory.
 * See docs/ADRs/relative-links/0003-rebase-base-resolution.md and 0004-rebased-path-format.md.
 */
export function rebaseUrl(url: string, sourceUrl: URL, hostUrl: URL): string {
    if (!isPathRelativeUrl(url)) return url;
    // A remote source can't be reached by a relative path.
    if (sourceUrl.protocol !== 'file:') return new URL(url, sourceUrl).href;
    if (hostUrl.protocol !== 'file:') return url;

    const sourceDir = posix.dirname(sourceUrl.pathname);
    const hostDir = posix.dirname(hostUrl.pathname);
    if (sourceDir === hostDir) return url;

    // Split off `?query#fragment` so only the path is touched; its encoding is kept as written.
    const suffixAt = url.search(/[?#]/);
    const path = suffixAt < 0 ? url : url.slice(0, suffixAt);
    const suffix = suffixAt < 0 ? '' : url.slice(suffixAt);

    // An empty path (`?x`) refers to the source document itself.
    const target = path ? posix.join(sourceDir, path) : sourceUrl.pathname;
    const rel = posix.relative(hostDir, target);
    if (!rel) return './' + suffix;
    const trailingSlash = path.endsWith('/') && !rel.endsWith('/') ? '/' : '';
    return rel + trailingSlash + suffix;
}

/**
 * Rebase the URLs of every `link`, `image` and `definition` node in `tree`, in place.
 * See docs/ADRs/relative-links/0001-rebase-scope.md.
 */
export function rebaseLinks<T extends Nodes>(tree: T, sourceUrl: URL, hostUrl: URL): T {
    visit(tree, ['link', 'image', 'definition'], (node) => {
        if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return;
        node.url = rebaseUrl(node.url, sourceUrl, hostUrl);
    });
    return tree;
}

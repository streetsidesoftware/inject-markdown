import fsPath from 'node:path';
import * as url from 'node:url';
import { posix } from 'path';

const isUrlRegExp = /^(https?|file):/i;

const urlHashRegExp = /#.*/;
const urlSearchRegExp = /[?][^#]*/;

export function isURL(url: unknown): url is URL {
    return url instanceof URL;
}

/**
 * Convert a path to a URL.
 * @param path - path
 * @param rel - Optional URL to be relative to.
 * @returns a URL
 */
export function pathToUrl(path: string | URL, rel?: URL): URL {
    if (isURL(path)) return path;
    if (isUrlRegExp.test(path)) return new URL(path, rel);

    const possibleUrl = new URL(path.replace(/\\/g, '/'), rel || url.pathToFileURL('./'));

    if (possibleUrl.protocol !== 'file:') {
        return possibleUrl;
    }

    // Remove params and hash.
    const pathOnly = path.replace(/[#?].*/g, '');
    const relDir = rel ? url.fileURLToPath(rel) : '';
    const resolved = fsPath.resolve(relDir, pathOnly);
    const pathUrl = url.pathToFileURL(resolved);
    if (!pathUrl.pathname.endsWith('/') && (pathOnly.endsWith('/') || pathOnly.endsWith('\\'))) {
        pathUrl.pathname += '/';
    }
    pathUrl.search = possibleUrl.search;
    pathUrl.hash = possibleUrl.hash;
    return pathUrl;
}

/**
 * Convert a directory path to a URL.
 * It ensures the resulting URL can be used as the root
 * of a relative URL.
 * @param dir - directory
 * @param rel - Optional URL to be relative to.
 * @returns a URL
 */
export function dirToUrl(dir: string | URL, rel?: URL): URL {
    const dirUrl = pathToUrl(dir, rel);
    if (!dirUrl.pathname.endsWith('/')) {
        const pathname = dirUrl.pathname + '/';
        if (dir === dirUrl) {
            return pathToUrl(pathname, dirUrl);
        }
        dirUrl.pathname = pathname;
    }
    return dirUrl;
}

/**
 * Determine the relative path.
 * @param fromUrl - from URL
 * @param toUrl - to URL
 * @returns the relative path
 */
export function relativePath(fromUrl: URL, toUrl: URL): RelURL {
    return new RelUrlImpl(posix.relative(fromUrl.pathname, toUrl.pathname), toUrl.search, toUrl.hash);
}

/**
 * The URL equivalent of `path.dirname`.
 * @param url - the url
 * @returns the parent URL.
 */
export function urlDirectory(url: URL): URL {
    return dirToUrl(posix.dirname(url.pathname), url);
}

export function parseRelativeUrl(url: string): RelURL {
    url = url.trim();
    const hash = url.match(urlHashRegExp)?.[0] || '';
    const search = url.match(urlSearchRegExp)?.[0] || '';
    const pathname = url.replace(/[?#].*/, '');
    return new RelUrlImpl(pathname, search, hash);
}

export interface RelURL {
    readonly pathname: string;
    readonly hash: string;
    readonly search: string;
    readonly href: string;
    toUrl(baseUrl: URL): URL;
}

class RelUrlImpl implements RelURL {
    private url: URL;

    constructor(readonly pathname: string, search: string, hash: string) {
        this.url = new URL('rel-url://');
        this.url.hash = hash;
        this.url.search = search;
    }

    get search() {
        return this.url.search;
    }

    get hash() {
        return this.url.hash;
    }

    get href() {
        const { pathname } = this;
        const { search, hash } = this.url;
        return pathname + search + hash;
    }

    toString(): string {
        return this.href;
    }

    toUrl(baseUrl: URL): URL {
        return new URL(this.href, baseUrl);
    }
}

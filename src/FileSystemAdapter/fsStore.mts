import { pathToFileURL } from 'url';

import { PathLike } from './FileSystemAdapter.js';

export interface Store<T> {
    get(file: PathLike): T | undefined;
    set(file: PathLike, data: T | undefined): void;
}

export function createStore<T>(): Store<T> {
    const store = new Map<string, T | undefined>();

    function get(file: PathLike) {
        const p = normalizePath(file).toString();
        return store.get(p);
    }

    function set(file: PathLike, data: T | undefined) {
        const p = normalizePath(file).href;
        if (typeof data === undefined) {
            store.delete(p);
            return;
        }
        store.set(p, data);
    }

    return { get, set };
}

export function normalizePath(pathLike: PathLike): URL {
    pathLike = typeof pathLike !== 'string' ? pathLike.href : pathLike;
    const url = pathToFileURL(pathLike);
    url.hash = '';
    return url;
}

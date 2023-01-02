import { RelURL } from './url_helper.js';

export interface InjectInfo {
    heading?: string | undefined;
    /** code bock language */
    lang?: string | undefined;
    /** lines to use */
    lines?: [number, number] | undefined;
    tags?: string[] | undefined;
    params?: Map<string, string | string[]>;
}

export function parseHash(url: URL | RelURL): InjectInfo {
    const info = parseHashString(url.hash);

    if (!info.heading && !info.lines && info.tags?.length) {
        info.heading = info.tags[0];
    }

    return info;
}

const regExLineNumExpression = /^(L\d+)(?:-(L\d+))?$/;

export function parseHashString(hash: string): InjectInfo {
    hash = hash.replace(/^#/, '');
    if (!hash) return {};

    const info: InjectInfo = {};

    const params = new URLSearchParams(hash);
    const tags: string[] = [];

    const p = new Map<string, string | string[]>();

    function addParam(key: string, value: string) {
        const v = p.get(key);
        if (v !== undefined) {
            const isArray = Array.isArray(v);
            const a = isArray ? v : [v];
            a.push(value);
            !isArray && p.set(key, a);
            return;
        }
        p.set(key, value);
    }

    for (const [key, value] of params.entries()) {
        addParam(key, value);
        switch (key) {
            case 'code':
            case 'lang':
                info.lang = value;
                continue;
            case 'heading':
                info.heading = value;
                continue;
            case 'lines':
            case 'line':
                {
                    const range = parseLineNumbers(value);
                    if (range) {
                        info.lines = range;
                        continue;
                    }
                }
                break;
        }

        const lineRange = parseLineNumbers(key);
        if (lineRange) {
            info.lines = lineRange;
            continue;
        }

        !value && tags.push(key);
    }

    if (tags.length) {
        info.tags = tags;
    }

    if (p.size) {
        info.params = p;
    }

    return info;
}

function parseLineNumbers(ref: string): [number, number] | undefined {
    const match = ref.match(regExLineNumExpression);
    if (!match) return undefined;

    const start = match[1];
    const end = match[2] || start;
    const startNum = parseInt(start.slice(1));
    const endNum = parseInt(end.slice(1));
    if (startNum && endNum) {
        return [startNum, endNum];
    }
    return undefined;
}

import type { RelURL } from './url_helper.js';

export type Range = [number, number];

export interface InjectInfo {
    heading?: string | undefined;
    /** code bock language */
    lang?: string | undefined;
    /** lines to use */
    lines?: Range | undefined;
    tags?: string[] | undefined;
    params?: Map<string, string | string[]>;
    /** Inject the file as a quote */
    quote?: boolean;
    /** Indicate that markdown should be injected as code. */
    code?: string;
}

export function parseHash(url: URL | RelURL): InjectInfo {
    const info = parseHashString(url.hash);
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
            if (!isArray) p.set(key, a);
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
            case 'quote':
                info.quote = parseFlagValue(value, true);
                continue;
            case 'lines':
            case 'line':
                {
                    const range = parseLineNumbers(value);
                    if (isRange(range)) {
                        info.lines = range;
                        continue;
                    }
                }
                break;
        }

        const lineRange = parseLineNumbers(key);
        if (lineRange) {
            if (isRange(lineRange)) {
                info.lines = lineRange;
            } else {
                tags.push(key);
            }
            continue;
        }

        if (!value && info.heading === undefined) {
            info.heading = key;
        }

        if (!value) tags.push(key);
    }

    if (tags.length) {
        info.tags = tags;
    }

    if (p.size) {
        info.params = p;
    }

    return info;
}

function isRange(a: number[] | unknown): a is Range {
    if (!Array.isArray(a)) return false;
    return a.length === 2 && typeof a[0] === 'number' && typeof a[1] === 'number';
}

function parseLineNumbers(ref: string): [number, number] | number[] | undefined {
    const match = ref.match(regExLineNumExpression);
    if (!match) return undefined;

    const start = match[1];
    const end = match[2] || start;
    const startNum = parseInt(start.slice(1));
    const endNum = parseInt(end.slice(1));
    if (startNum && endNum) {
        return [startNum, endNum];
    }
    return [];
}

const tfValues: Record<string, boolean | undefined> = {
    true: true,
    t: true,
    yes: true,
    y: true,
    false: false,
    f: false,
    no: false,
    n: false,
};

function parseFlagValue(value: string, defaultValue: boolean): boolean {
    const r = tfValues[value];
    return r ?? defaultValue;
}

import type { RelURL } from './url_helper.js';
import { parseSingleValue, parseValuesFileList, parseValuesPairs, type ValueDeclaration } from './values.js';

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
    /** Bare `#markdown`: parse table cells as inline Markdown. See ADR-0008. */
    markdown?: boolean | undefined;
    /** Bare `#html-table`: emit an HTML table whose cells hold Markdown. See ADR-0010. */
    htmlTable?: boolean | undefined;
    /** `rebase-links=false` keeps relative URLs as written. See docs/ADRs/relative-links/0002-default-on-with-opt-out.md. */
    rebaseLinks?: boolean | undefined;
    /** Raw `header-rows` value; bare means 1. Validated when the table is built. See ADR-0002. */
    headerRows?: string | undefined;
    /** Row window for tables, validated when the table is built. See ADR-0004. */
    startRow?: string | undefined;
    endRow?: string | undefined;
    numRows?: string | undefined;
    /**
     * `values=`, `value=`, `values-file=` and `value-alias=` entries in written order; the newest
     * wins (ADR-0012). See ADR-0002, ADR-0007, ADR-0010, ADR-0013.
     */
    valueDecls?: ValueDeclaration[] | undefined;
    /** Malformed `value=` occurrences, reported as directive errors (ADR-0013 point 3). */
    valueErrors?: string[] | undefined;
    /** Bare `#vars` opt-in: scan for placeholders using CLI/environment sources alone. See ADR-0002. */
    vars?: boolean | undefined;
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

    const valueDecls: ValueDeclaration[] = [];
    const valueErrors: string[] = [];

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
            case 'values':
                for (const [name, v] of parseValuesPairs(value)) valueDecls.push({ kind: 'value', name, value: v });
                continue;
            case 'value': {
                // A bare `#value` is indistinguishable from `#value=` and keeps its heading meaning (ADR-0013 point 3).
                if (!value) break;
                const pair = parseSingleValue(value);
                if (pair) {
                    valueDecls.push({ kind: 'value', name: pair[0], value: pair[1] });
                } else {
                    valueErrors.push(`Invalid value="${value}": expected name:value.`);
                }
                continue;
            }
            case 'values-file':
                for (const entry of parseValuesFileList(value)) valueDecls.push({ kind: 'values-file', entry });
                continue;
            case 'vars':
                info.vars = parseFlagValue(value, true);
                continue;
            case 'markdown':
                info.markdown = parseFlagValue(value, true);
                continue;
            case 'html-table':
                info.htmlTable = parseFlagValue(value, true);
                continue;
            case 'header-rows':
                info.headerRows = value;
                continue;
            case 'start-row':
                info.startRow = value;
                continue;
            case 'end-row':
                info.endRow = value;
                continue;
            case 'num-rows':
                info.numRows = value;
                continue;
            case 'rebase-links':
                info.rebaseLinks = parseFlagValue(value, true);
                continue;
            case 'value-alias':
                // Same `name:target` list shape as `values=` (ADR-0010 point 1).
                for (const [name, target] of parseValuesPairs(value)) valueDecls.push({ kind: 'alias', name, target });
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

    // Kept even when empty, so a `values=`/`values-file=`/`value-alias=` that parsed to nothing still
    // opts the directive in. A bare `value` is excluded: it keeps its heading meaning (ADR-0013 point 3).
    if (valueDecls.length || hasValueKey(p)) info.valueDecls = valueDecls;
    if (valueErrors.length) info.valueErrors = valueErrors;

    if (p.size) {
        info.params = p;
    }

    return info;
}

function hasValueKey(params: Map<string, unknown>): boolean {
    return params.has('values') || params.has('values-file') || params.has('value-alias');
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

import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue | undefined;
}

/** A `values-file=`/`--values-file` entry's namespace: an explicit prefix, an auto-derived one, or a root merge. */
export type ValuesFilePrefixKind = 'explicit' | 'auto' | 'root';

export interface ValuesFileEntry {
    prefixKind: ValuesFilePrefixKind;
    /** Only set when `prefixKind` is `'explicit'`. */
    prefixName?: string | undefined;
    path: string;
}

const validPlaceholderSegment = /^[A-Za-z0-9_-]+$/;

/** A placeholder-name segment: `[A-Za-z0-9_-]+`, per ADR-0001. */
export function isValidPlaceholderSegment(name: string): boolean {
    return validPlaceholderSegment.test(name);
}

/**
 * Parse `values=name:val,name2:val2`, per ADR-0002 point 1.
 * A whole value wrapped in double quotes suppresses comma-splitting, producing one pair whose
 * value may contain literal commas/colons (`values="name:1, 2, 3"`).
 */
export function parseValuesOption(raw: string): Map<string, string> {
    const pairs = new Map<string, string>();
    const trimmed = raw.trim();
    if (!trimmed) return pairs;

    function addPair(entry: string): void {
        const idx = entry.indexOf(':');
        if (idx < 0) return;
        const name = entry.slice(0, idx).trim();
        const value = entry.slice(idx + 1).trim();
        if (!name) return;
        pairs.set(name, value);
    }

    if (isQuoted(trimmed)) {
        addPair(unquote(trimmed));
        return pairs;
    }

    for (const entry of trimmed.split(',')) {
        addPair(entry);
    }
    return pairs;
}

/** Parse one `values-file=`/`--values-file` entry: `[prefix:]path`, per ADR-0007. */
export function parseValuesFileEntry(raw: string): ValuesFileEntry {
    const entry = raw.trim();
    if (entry.startsWith(':')) {
        return { prefixKind: 'root', path: unquote(entry.slice(1).trim()) };
    }
    if (isQuoted(entry)) {
        return { prefixKind: 'auto', path: unquote(entry) };
    }
    const idx = entry.indexOf(':');
    if (idx >= 0) {
        const prefixName = entry.slice(0, idx).trim();
        const path = unquote(entry.slice(idx + 1).trim());
        return { prefixKind: 'explicit', prefixName, path };
    }
    return { prefixKind: 'auto', path: unquote(entry) };
}

/**
 * Parse a directive-level `values-file=[prefix:]path[,[prefix:]path...]` list, per ADR-0007.
 * A comma inside a double-quoted entry is not treated as a separator.
 */
export function parseValuesFileList(raw: string): ValuesFileEntry[] {
    return splitTopLevel(raw.trim(), ',').map(parseValuesFileEntry);
}

function splitTopLevel(s: string, sep: string): string[] {
    const parts: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of s) {
        if (ch === '"') {
            inQuotes = !inQuotes;
            cur += ch;
            continue;
        }
        if (ch === sep && !inQuotes) {
            parts.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    parts.push(cur);
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function isQuoted(s: string): boolean {
    return s.length >= 2 && s.startsWith('"') && s.endsWith('"');
}

function unquote(s: string): string {
    return isQuoted(s) ? s.slice(1, -1) : s;
}

/** Strip a path's final extension and directory to derive its auto prefix, per ADR-0007 point 2. */
export function deriveAutoPrefixFromPath(p: string): string {
    const normalized = p.replace(/\\/g, '/');
    const slashIdx = normalized.lastIndexOf('/');
    const base = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
    const dotIdx = base.lastIndexOf('.');
    return dotIdx > 0 ? base.slice(0, dotIdx) : base;
}

/** Walk a dotted placeholder name into a value tree. `undefined` means the name is not defined. */
export function getPath(tree: JsonObject | undefined, name: string): JsonValue | undefined {
    if (!tree) return undefined;
    let cur: JsonValue | undefined = tree;
    for (const seg of name.split('.')) {
        if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined;
        cur = cur[seg];
    }
    return cur;
}

/** Set a dotted placeholder name into a value tree, creating intermediate objects as needed. */
export function setPath(tree: JsonObject, name: string, value: JsonValue): void {
    const segments = name.split('.');
    let cur = tree;
    for (let i = 0; i < segments.length - 1; ++i) {
        const seg = segments[i];
        const next = cur[seg];
        if (typeof next !== 'object' || next === null || Array.isArray(next)) {
            const obj: JsonObject = {};
            cur[seg] = obj;
            cur = obj;
        } else {
            cur = next;
        }
    }
    cur[segments[segments.length - 1]] = value;
}

/** A JSON object/array is never a valid substitution value, per ADR-0005 point 3. */
export function isScalar(v: JsonValue | undefined): v is JsonScalar {
    return v !== undefined && v !== null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
}

/** Build a nested value tree from a flat map of dotted `name -> value` pairs (e.g. inline `values=`/`--value`). */
export function treeFromFlatMap(pairs: ReadonlyMap<string, string> | undefined): JsonObject | undefined {
    if (!pairs || !pairs.size) return undefined;
    const tree: JsonObject = {};
    for (const [name, value] of pairs) setPath(tree, name, value);
    return tree;
}

function mergeRoot(target: JsonObject, data: JsonValue): void {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return;
    for (const [k, v] of Object.entries(data)) target[k] = v;
}

/**
 * Read and merge a list of `values-file=`/`--values-file` entries into one value tree, per ADR-0007.
 * Later entries win on a prefix/root-key collision. A per-entry read/parse failure or invalid
 * auto-derived prefix is reported via `onError` and that entry is skipped, rather than failing the
 * whole list.
 */
export async function buildValuesFileTree(
    fs: FileSystemAdapter,
    entries: ValuesFileEntry[],
    resolvePath: (path: string) => Promise<PathLike>,
    onError: (message: string) => void,
    encoding: BufferEncoding = 'utf8',
): Promise<JsonObject | undefined> {
    if (!entries.length) return undefined;
    const tree: JsonObject = {};
    for (const entry of entries) {
        let data: JsonValue;
        try {
            const resolved = await resolvePath(entry.path);
            const text = await fs.readFile(resolved, encoding);
            data = JSON.parse(text);
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            onError(`Failed to read values file "${entry.path}": ${err}`);
            continue;
        }
        if (entry.prefixKind === 'root') {
            mergeRoot(tree, data);
            continue;
        }
        const prefix =
            entry.prefixKind === 'explicit' ? (entry.prefixName ?? '') : deriveAutoPrefixFromPath(entry.path);
        if (!isValidPlaceholderSegment(prefix)) {
            onError(
                `Invalid values-file prefix "${prefix}" derived from "${entry.path}". Use an explicit prefix or ":${entry.path}" to merge at the root.`,
            );
            continue;
        }
        tree[prefix] = data;
    }
    return tree;
}

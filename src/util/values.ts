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

const validPlaceholderSegment = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/**
 * A values-file prefix, per ADR-0009 point 1: the placeholder-name grammar plus a two-character
 * minimum, which is what keeps a one-character Windows drive letter from ever being read as one.
 */
const validValuesFilePrefix = /^(?=.{2,})[A-Za-z0-9_][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_][A-Za-z0-9_-]*)*$/;

/** A leading `<letter>:`, which is a Windows drive and not part of the basename (ADR-0009 point 5). */
const driveLetterPrefix = /^[A-Za-z]:/;

/**
 * Segments that would reach `Object.prototype` if walked or written. They match the ADR-0001
 * grammar, so they have to be rejected by name rather than by the character class.
 */
const unsafeSegments = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * A placeholder-name segment: `[A-Za-z0-9_][A-Za-z0-9_-]*`, per ADR-0001 point 2 — a hyphen may
 * appear inside a segment but never at its start — excluding prototype-reaching names.
 */
export function isValidPlaceholderSegment(name: string): boolean {
    return validPlaceholderSegment.test(name) && !unsafeSegments.has(name);
}

/**
 * A `values-file=`/`--values-file` explicit prefix, per ADR-0009 point 1. Two characters or more,
 * dot-separated segments with none empty and none starting with `-` or `.`, and no path
 * separators — so `C:`, `..`, `.env` and `-foo` are all paths rather than prefixes.
 */
export function isValidValuesFilePrefix(name: string): boolean {
    return validValuesFilePrefix.test(name) && !name.split('.').some((seg) => unsafeSegments.has(seg));
}

/** A value tree, with no prototype: a `__proto__` key can never reach `Object.prototype`. */
function emptyTree(): JsonObject {
    return Object.create(null) as JsonObject;
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
    // The colon separates only when what precedes it is a prefix (ADR-0009 point 1). Anything
    // else -- a drive letter, `..`, a path-shaped head -- leaves the whole entry a path.
    const idx = entry.indexOf(':');
    if (idx > 0) {
        const prefixName = entry.slice(0, idx).trim();
        if (isValidValuesFilePrefix(prefixName)) {
            return { prefixKind: 'explicit', prefixName, path: unquote(entry.slice(idx + 1).trim()) };
        }
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

/**
 * Strip a path's Windows drive, directory and final extension to derive its auto prefix, per
 * ADR-0007 point 2 and ADR-0009 point 5. The drive goes first, so `c:package.json` derives
 * `package` rather than the unusable `c:package`.
 */
export function deriveAutoPrefixFromPath(p: string): string {
    const normalized = p.replace(driveLetterPrefix, '').replace(/\\/g, '/');
    const slashIdx = normalized.lastIndexOf('/');
    const base = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
    const dotIdx = base.lastIndexOf('.');
    return dotIdx > 0 ? base.slice(0, dotIdx) : base;
}

/**
 * Walk a dotted placeholder name into a value tree. `undefined` means the name is not defined.
 * Only own properties count: a `values-file=` tree comes from `JSON.parse` and still inherits from
 * `Object.prototype`, so `{@ toString @}` must not resolve to an inherited member.
 */
export function getPath(tree: JsonObject | undefined, name: string): JsonValue | undefined {
    if (!tree) return undefined;
    let cur: JsonValue | undefined = tree;
    for (const seg of name.split('.')) {
        if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined;
        if (!Object.hasOwn(cur, seg)) return undefined;
        cur = cur[seg];
    }
    return cur;
}

/**
 * Set a dotted placeholder name into a value tree, creating intermediate objects as needed.
 * A name containing a prototype-reaching segment is dropped: directive text is untrusted input
 * (ADR-0003), and `values=__proto__.x:y` must not be able to write to `Object.prototype`.
 */
export function setPath(tree: JsonObject, name: string, value: JsonValue): void {
    const segments = name.split('.');
    if (segments.some((seg) => unsafeSegments.has(seg))) return;
    let cur = tree;
    for (let i = 0; i < segments.length - 1; ++i) {
        const seg = segments[i];
        const next = Object.hasOwn(cur, seg) ? cur[seg] : undefined;
        if (typeof next !== 'object' || next === null || Array.isArray(next)) {
            const obj = emptyTree();
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

/**
 * One assignment's worth of values, per ADR-0008 point 1. Layers are never combined; resolution
 * walks an ordered list of them.
 */
export type ValueLayer = JsonObject;

/**
 * How a name failed to resolve, so the caller can report which of ADR-0005 point 4's two cases it
 * is: nothing defines the name at all, or every layer holding it holds a branch rather than a leaf.
 */
export type UnresolvedReason = 'undefined' | 'object' | 'array' | 'null' | 'cycle';

export type ResolveResult = { value: string } | { unresolved: UnresolvedReason };

/**
 * One layer per `name -> value` pair (e.g. inline `values=`/`--value`), highest precedence first.
 * Per-pair rather than one folded tree so `--value a=1 --value a.b=2` keeps both names, per
 * ADR-0008 point 1; the last-listed pair wins because it lands first in the returned order.
 */
export function layersFromFlatMap(pairs: ReadonlyMap<string, string> | undefined): ValueLayer[] {
    if (!pairs?.size) return [];
    const layers: ValueLayer[] = [];
    for (const [name, value] of pairs) {
        const layer = emptyTree();
        setPath(layer, name, value);
        layers.push(layer);
    }
    return layers.reverse();
}

/** Walk an ordered layer list, taking the first layer holding `name` as a scalar, per ADR-0008 point 3. */
export function resolveInLayers(layers: readonly ValueLayer[], name: string): ResolveResult {
    let blocked: UnresolvedReason | undefined;
    for (const layer of layers) {
        const v = getPath(layer, name);
        if (v === undefined) continue;
        if (isScalar(v)) return { value: String(v) };
        // A non-scalar or null never resolves and never stops the search (ADR-0008 points 3-4);
        // remember the most specific one seen so the warning can name it.
        blocked ??= v === null ? 'null' : Array.isArray(v) ? 'array' : 'object';
    }
    return { unresolved: blocked ?? 'undefined' };
}

/**
 * Read a list of `values-file=`/`--values-file` entries into one layer each, per ADR-0007 and
 * ADR-0008, highest precedence (last-listed) first. A per-entry read/parse failure or invalid
 * auto-derived prefix is reported via `onError` and that entry is skipped, rather than failing the
 * whole list.
 */
export async function buildValuesFileLayers(
    fs: FileSystemAdapter,
    entries: ValuesFileEntry[],
    resolvePath: (path: string) => Promise<PathLike>,
    onError: (message: string) => void,
    encoding: BufferEncoding = 'utf8',
): Promise<ValueLayer[]> {
    if (!entries.length) return [];
    const layers: ValueLayer[] = [];
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
            // A root entry contributes its own keys, so it is only usable as a layer if it is an
            // object; an array or scalar at the top level has no names to offer.
            if (typeof data !== 'object' || data === null || Array.isArray(data)) continue;
            const layer = emptyTree();
            for (const [k, v] of Object.entries(data)) layer[k] = v;
            layers.push(layer);
            continue;
        }
        const explicit = entry.prefixKind === 'explicit';
        const prefix = explicit ? (entry.prefixName ?? '') : deriveAutoPrefixFromPath(entry.path);
        // An explicit prefix was already checked by `parseValuesFileEntry` -- the colon would not
        // have separated otherwise. An auto-derived one stays a single segment (ADR-0009 point 4).
        if (!explicit && !isValidPlaceholderSegment(prefix)) {
            onError(
                `Invalid values-file prefix "${prefix}" derived from "${entry.path}". Use an explicit prefix or ":${entry.path}" to merge at the root.`,
            );
            continue;
        }
        const layer = emptyTree();
        // `setPath` so a dotted explicit prefix nests, per ADR-0009 point 3.
        setPath(layer, prefix, data);
        layers.push(layer);
    }
    return layers.reverse();
}

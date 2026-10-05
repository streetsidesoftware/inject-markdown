import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue | undefined;
}

/** A values file, and where its values go. */
export interface ValuesFileEntry {
    /** The JSON file to read. */
    path: string;
    /**
     * Where the file's values go:
     * - A prefix nests all of the file's values under it.
     *   For example, with the prefix `package`, the file's `version` is `{​@ package.version @​}`.
     * - `''` puts them at the top level.
     *   For example, the file's `version` is `{​@ version @​}`.
     */
    prefix: string;
}

/**
 * Sets one placeholder to a fixed value.
 * @example { kind: 'value', name: 'version', value: '1.2.3' }
 */
export interface ValuePairDeclaration {
    kind: 'value';
    /** The placeholder name, such as `version` or `package.version`. */
    name: string;
    /** The text the placeholder is replaced with. */
    value: string;
}

/**
 * Reads placeholder values from a JSON file.
 * @example { kind: 'values-file', path: 'package.json', prefix: 'package' }
 */
export interface ValuesFileDeclaration extends ValuesFileEntry {
    kind: 'values-file';
}

/**
 * Makes one placeholder name stand for another.
 * @example { kind: 'alias', name: 'version', target: 'package.version' }
 */
export interface ValueAliasDeclaration {
    kind: 'alias';
    /** The new placeholder name. */
    name: string;
    /** The placeholder name it stands for. */
    target: string;
}

/**
 * A placeholder value declaration, one of:
 * - {@link ValuePairDeclaration}: a fixed value.
 * - {@link ValuesFileDeclaration}: values from a JSON file.
 * - {@link ValueAliasDeclaration}: one name standing for another.
 *
 * When declarations disagree, the later one in the list wins.
 */
export type ValueDeclaration = ValuePairDeclaration | ValuesFileDeclaration | ValueAliasDeclaration;

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

/** A dotted placeholder name: one or more valid segments separated by `.`. */
export function isValidPlaceholderName(name: string): boolean {
    return name.split('.').every(isValidPlaceholderSegment);
}

/**
 * A valid explicit prefix in `[prefix:]path` text:
 * - two characters or more;
 * - dot-separated segments, none empty, none starting with `-` or `.`;
 * - no path separators.
 * So `C:`, `..`, `.env` and `-foo` are read as paths, not prefixes.
 */
export function isValidValuesFilePrefix(name: string): boolean {
    return validValuesFilePrefix.test(name) && !name.split('.').some((seg) => unsafeSegments.has(seg));
}

/** A value tree, with no prototype: a `__proto__` key can never reach `Object.prototype`. */
function emptyTree(): JsonObject {
    return Object.create(null) as JsonObject;
}

/**
 * Parse a comma-separated `name:value` list, e.g. `a:1,b:2`.
 * Pairs keep their written order, repeats included.
 * A list wrapped in double quotes isn't split: it is one pair, e.g. `"name:1, 2, 3"`.
 */
export function parseValuesPairs(raw: string): [name: string, value: string][] {
    const pairs: [string, string][] = [];
    const trimmed = raw.trim();
    if (!trimmed) return pairs;

    function addPair(entry: string): void {
        const pair = splitPair(entry);
        if (pair) pairs.push(pair);
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

/**
 * Parse one `name:value`.
 * It splits at the first `:`. The rest is the value, including any commas and colons.
 * Returns `undefined` when there is no `:` or the name is empty.
 */
export function parseSingleValue(raw: string): [name: string, value: string] | undefined {
    return splitPair(raw);
}

function splitPair(entry: string): [string, string] | undefined {
    const idx = entry.indexOf(':');
    if (idx < 0) return undefined;
    const name = entry.slice(0, idx).trim();
    if (!name) return undefined;
    return [name, entry.slice(idx + 1).trim()];
}

/**
 * Parse one `[prefix:]path` entry:
 * - `prefix:path` uses that prefix;
 * - `:path` uses an empty (root) prefix;
 * - `path` derives the prefix from the file's base name (`package.json` → `package`).
 * Returns `undefined` when a derived prefix isn't a valid name segment.
 */
export function parseValuesFileEntry(raw: string): ValuesFileEntry | undefined {
    const entry = raw.trim();
    if (entry.startsWith(':')) {
        return { prefix: '', path: unquote(entry.slice(1).trim()) };
    }
    if (isQuoted(entry)) {
        return withDerivedPrefix(unquote(entry));
    }
    // The colon separates only when what precedes it is a prefix (ADR-0009 point 1). Anything
    // else -- a drive letter, `..`, a path-shaped head -- leaves the whole entry a path.
    const idx = entry.indexOf(':');
    if (idx > 0) {
        const prefix = entry.slice(0, idx).trim();
        if (isValidValuesFilePrefix(prefix)) {
            return { prefix, path: unquote(entry.slice(idx + 1).trim()) };
        }
    }
    return withDerivedPrefix(unquote(entry));
}

/**
 * A derived prefix must be a single name segment.
 * Only an explicit prefix may be dotted.
 */
function withDerivedPrefix(path: string): ValuesFileEntry | undefined {
    const prefix = deriveAutoPrefixFromPath(path);
    return isValidPlaceholderSegment(prefix) ? { prefix, path } : undefined;
}

/**
 * Split a comma-separated list of `[prefix:]path` entries.
 * A comma inside a double-quoted entry is not a separator.
 */
export function splitValuesFileList(raw: string): string[] {
    return splitTopLevel(raw.trim(), ',');
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
 * Walk a dotted placeholder name into a value tree.
 * `undefined` means the name is not defined.
 * Only own properties count. A values-file tree comes from `JSON.parse`, so it inherits from
 * `Object.prototype`, and the placeholder `toString` must not resolve to an inherited member.
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
 * A name with a prototype-reaching segment is dropped.
 * Directive text is untrusted, and a name like `__proto__.x` must not write to `Object.prototype`.
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

/** A placeholder name that resolved to a value. */
export interface ResolvedValue {
    value: string;
}

/** A placeholder name that did not resolve, and why. */
export interface UnresolvedValue {
    unresolved: UnresolvedReason;
}

export type ResolveResult = ResolvedValue | UnresolvedValue;

/**
 * The layer for one `name -> value` pair.
 * Each pair gets its own layer rather than one folded tree.
 * That way, the pairs `a -> 1` and `a.b -> 2` keep both names.
 */
export function layerFromPair(name: string, value: string): ValueLayer {
    const layer = emptyTree();
    setPath(layer, name, value);
    return layer;
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
 * Read one values file into its layer.
 * A read or parse failure is reported via `onError` and yields `undefined`.
 * One bad entry doesn't fail the rest of the sequence.
 */
export async function readValuesFileLayer(
    fs: FileSystemAdapter,
    entry: ValuesFileEntry,
    resolvePath: (path: string) => Promise<PathLike>,
    onError: (message: string) => void,
    encoding: BufferEncoding = 'utf8',
): Promise<ValueLayer | undefined> {
    let data: JsonValue;
    try {
        const resolved = await resolvePath(entry.path);
        const text = await fs.readFile(resolved, encoding);
        data = JSON.parse(text);
    } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        onError(`Failed to read values file "${entry.path}": ${err}`);
        return undefined;
    }
    if (entry.prefix === '') {
        // A root entry contributes its own keys, so it is only usable as a layer if it is an
        // object; an array or scalar at the top level has no names to offer.
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
        const layer = emptyTree();
        for (const [k, v] of Object.entries(data)) layer[k] = v;
        return layer;
    }
    const layer = emptyTree();
    // `setPath` so a dotted explicit prefix nests, per ADR-0009 point 3.
    setPath(layer, entry.prefix, data);
    return layer;
}

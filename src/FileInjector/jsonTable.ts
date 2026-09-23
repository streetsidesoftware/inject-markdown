import { applyRowWindow, type RowWindow } from './rowWindow.js';
import type { CellValue } from './Table.js';

type JsonObject = Record<string, unknown>;

/**
 * Turn a JSON table source into rows: the key header, then one row per element in the window
 * (ADR-0011). Throws on invalid JSON or any shape other than a non-empty array of objects.
 */
export function jsonToRows(text: string, window: RowWindow): CellValue[][] {
    const data = parseJson(text);
    if (!Array.isArray(data)) throw new Error(`Expected a JSON array of objects, found ${describe(data)}.`);
    if (!data.length) throw new Error('Expected a JSON array of objects, found an empty array.');
    data.forEach((element, i) => {
        if (!isObject(element)) {
            throw new Error(`Expected a JSON array of objects, but element ${i + 1} is ${describe(element)}.`);
        }
    });
    const objects = data as JsonObject[];
    const windowed = applyRowWindow(objects, window);
    // An empty window still gets a header: all keys in the file (point 4).
    const columns = collectKeys(windowed.length ? windowed : objects);
    return [columns, ...windowed.map((obj) => columns.map((key) => toCellValue(obj, key)))];
}

/** Apply `fn` to every string leaf of a nested JSON value; keys are left alone (point 8). */
export function mapJsonStrings(value: unknown, fn: (s: string) => string): unknown {
    if (typeof value === 'string') return fn(value);
    if (Array.isArray(value)) return value.map((v) => mapJsonStrings(v, fn));
    if (isObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapJsonStrings(v, fn)]));
    }
    return value;
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
}

function collectKeys(objects: JsonObject[]): string[] {
    const keys = new Set<string>();
    for (const obj of objects) {
        for (const key of Object.keys(obj)) keys.add(key);
    }
    return [...keys];
}

function toCellValue(obj: JsonObject, key: string): CellValue {
    const value = Object.hasOwn(obj, key) ? obj[key] : undefined;
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return { json: value };
    return String(value);
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return value.length ? 'an array' : 'an empty array';
    if (typeof value === 'object') return 'an object';
    return `a ${typeof value}`;
}

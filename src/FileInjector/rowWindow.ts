/** Default `num-rows` (ADR-0004). */
export const defaultNumRows = 10_000;

export interface RowWindowOptions {
    startRow?: string | undefined;
    endRow?: string | undefined;
    numRows?: string | undefined;
}

/** A 1-based, inclusive range of data rows. `last < first` selects nothing. */
export interface RowWindow {
    first: number;
    last: number;
}

/**
 * Resolve `start-row`/`end-row`/`num-rows` into a window (ADR-0004).
 * Throws on a value that isn't a whole number, or on `start-row=0`.
 */
export function resolveRowWindow(options: RowWindowOptions): RowWindow {
    const first = parseCount('start-row', options.startRow) ?? 1;
    if (first < 1) throw new Error('Invalid start-row "0": row numbers start at 1.');
    const numRows = parseCount('num-rows', options.numRows) ?? defaultNumRows;
    const endRow = parseCount('end-row', options.endRow);
    const last = first + numRows - 1;
    return { first, last: endRow === undefined ? last : Math.min(last, endRow) };
}

/** The data rows inside the window; empty when it is out of range or `last < first`. */
export function applyRowWindow<T>(rows: T[], window: RowWindow): T[] {
    if (window.last < window.first) return [];
    return rows.slice(window.first - 1, window.last);
}

function parseCount(name: string, value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (!/^\d+$/.test(value)) throw new Error(`Invalid ${name} "${value}": expected a whole number.`);
    return Number(value);
}

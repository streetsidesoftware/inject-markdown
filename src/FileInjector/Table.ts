import type { AlignType, PhrasingContent, Table, TableCell, TableRow } from 'mdast';

import type { RawTableOptions } from '../util/hash.js';
import { unquote } from '../util/values.js';

export type HeaderFormat = 'none' | 'title' | 'upper' | 'lower';

/** A `columns` entry: a 1-based source column number or a header name, plus an optional alignment marker. */
export interface ColumnRef {
    ref: number | string;
    align: AlignType | undefined;
}

export interface TableOptions {
    /** Number of leading rows treated as the header. See table-improvements ADR-0002. */
    headerRows: number;
    /** Output columns, in order. All source columns when undefined. See ADR-0003. */
    columns?: ColumnRef[] | undefined;
    /** 1-based, counted from the first data row. See ADR-0004. */
    startRow: number;
    numRows: number;
    endRow?: number | undefined;
    headerFormat: HeaderFormat;
    /** Positional (output order) header overrides; an empty entry keeps the header. See ADR-0007. */
    columnNames?: string[] | undefined;
}

export const defaultTableOptions: Readonly<TableOptions> = {
    headerRows: 1,
    startRow: 1,
    numRows: 10_000,
    headerFormat: 'none',
};

/** Share of non-empty data cells that must look numeric for a column to right-align. See ADR-0005. */
const autoAlignThreshold = 0.9;

const headerFormats = new Set<string>(['none', 'title', 'upper', 'lower']);

/**
 * Validate the raw hash table options, throwing on a malformed value (ADR-0001 point 6).
 */
export function parseTableOptions(raw: RawTableOptions | undefined): TableOptions {
    const options: TableOptions = { ...defaultTableOptions };
    if (!raw) return options;

    function requireValue(key: keyof RawTableOptions): string | undefined {
        const value = raw?.[key];
        if (value === undefined) return undefined;
        if (!value.trim()) throw new Error(`Table option "${key}" requires a value.`);
        return value;
    }

    function parseCount(key: keyof RawTableOptions, min: number): number | undefined {
        const value = requireValue(key)?.trim();
        if (value === undefined) return undefined;
        const n = /^\d+$/.test(value) ? Number(value) : NaN;
        if (!(n >= min)) {
            throw new Error(`Table option "${key}" must be an integer >= ${min}, got "${value}".`);
        }
        return n;
    }

    // Bare `#header-rows` means `header-rows=1` (ADR-0001 point 5).
    const headerRows = raw['header-rows'];
    if (headerRows !== undefined) {
        options.headerRows = headerRows.trim() ? (parseCount('header-rows', 0) ?? 1) : 1;
    }
    options.startRow = parseCount('start-row', 1) ?? options.startRow;
    options.numRows = parseCount('num-rows', 0) ?? options.numRows;
    options.endRow = parseCount('end-row', 0);

    const headerFormat = requireValue('header-format')?.trim();
    if (headerFormat !== undefined) {
        if (!headerFormats.has(headerFormat)) {
            throw new Error(
                `Table option "header-format" must be one of none, title, upper, lower, got "${headerFormat}".`,
            );
        }
        options.headerFormat = headerFormat as HeaderFormat;
    }

    const columns = requireValue('columns');
    if (columns !== undefined) {
        options.columns = splitList(columns).map(parseColumnRef);
    }

    const columnNames = requireValue('column-names');
    if (columnNames !== undefined) {
        options.columnNames = splitList(columnNames).map((name) => name.trim());
    }

    return options;
}

/** Split a comma-separated list whose whole value may be double-quoted (ADR-0001 point 3). */
function splitList(value: string): string[] {
    return unquote(value.trim()).split(',');
}

function parseColumnRef(entry: string): ColumnRef {
    let ref = entry.trim();
    const alignLeft = ref.startsWith(':');
    if (alignLeft) ref = ref.slice(1);
    const alignRight = ref.endsWith(':');
    if (alignRight) ref = ref.slice(0, -1);
    ref = normalizeWhitespace(ref);
    if (!ref) throw new Error(`Empty column reference in table option "columns": "${entry}".`);
    const align: AlignType | undefined =
        alignLeft && alignRight ? 'center' : alignLeft ? 'left' : alignRight ? 'right' : undefined;
    return { ref: /^\d+$/.test(ref) ? Number(ref) : ref, align };
}

function normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Convert parsed rows into a GFM table. With default options the first row is the header
 * and every column is emitted; see the table-improvements ADRs for each option.
 */
export function rowsToTable(rows: string[][], options: Partial<TableOptions> = {}): Table {
    const opts: TableOptions = { ...defaultTableOptions, ...stripUndefined(options) };
    const sourceColumnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const headerRows = rows.slice(0, opts.headerRows);
    const body = windowRows(rows.slice(opts.headerRows), opts);

    const selected = resolveColumns(opts, headerRows, sourceColumnCount);

    const align = selected.map(({ index, align }) => align ?? autoAlign(body, index));

    const headerCells = selected.map(({ index }, i) => {
        const override = opts.columnNames?.[i];
        if (override) return toCell([{ type: 'text', value: override }]);
        if (!opts.headerRows) return toTextCell(String(index + 1));
        return toHeaderCell(headerRows, index, opts.headerFormat);
    });

    function toTableRow(cells: string[]): TableRow {
        return { type: 'tableRow', children: selected.map(({ index }) => toTextCell(cells[index])) };
    }

    return {
        type: 'table',
        align,
        children: [{ type: 'tableRow', children: headerCells }, ...body.map(toTableRow)],
    };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Apply `start-row`/`num-rows`/`end-row` to the data rows (ADR-0004); out of range is empty, not an error. */
function windowRows(dataRows: string[][], opts: TableOptions): string[][] {
    const start = opts.startRow;
    const last = Math.min(start + opts.numRows - 1, opts.endRow ?? Infinity);
    return last < start ? [] : dataRows.slice(start - 1, last);
}

interface SelectedColumn {
    /** 0-based source column index. */
    index: number;
    align: AlignType | undefined;
}

function resolveColumns(opts: TableOptions, headerRows: string[][], columnCount: number): SelectedColumn[] {
    if (!opts.columns) {
        return Array.from({ length: columnCount }, (_, index) => ({ index, align: undefined }));
    }

    // Match strings join a column's non-empty header cells with a space (ADR-0002).
    const matchStrings = Array.from({ length: columnCount }, (_, index) =>
        normalizeWhitespace(
            headerRows
                .map((row) => row[index] ?? '')
                .filter((cell) => cell.trim())
                .join(' '),
        ),
    );

    return opts.columns.map(({ ref, align }) => {
        if (typeof ref === 'number') {
            if (ref < 1 || ref > columnCount) {
                throw new Error(`Column ${ref} is out of range; the table has ${columnCount} column(s).`);
            }
            return { index: ref - 1, align };
        }
        if (!opts.headerRows) {
            throw new Error(`Column "${ref}" must be referenced by number when header-rows=0.`);
        }
        const index = matchStrings.indexOf(ref);
        if (index < 0) throw new Error(`Column "${ref}" not found in the table header.`);
        return { index, align };
    });
}

function toHeaderCell(headerRows: string[][], index: number, format: HeaderFormat): TableCell {
    const parts = headerRows
        .map((row) => row[index] ?? '')
        .filter((cell) => cell)
        .map((cell) => formatHeader(cell, format));
    // Multi-row headers join with an inline `<br />` html node so it isn't escaped (ADR-0002).
    const children: PhrasingContent[] = [];
    parts.forEach((value, i) => {
        if (i) children.push({ type: 'html', value: '<br />' });
        children.push({ type: 'text', value });
    });
    return toCell(children);
}

function formatHeader(text: string, format: HeaderFormat): string {
    switch (format) {
        case 'upper':
            return text.toUpperCase();
        case 'lower':
            return text.toLowerCase();
        case 'title':
            return text.replace(
                /(\S)(\S*)/gu,
                (_, first: string, rest: string) => first.toUpperCase() + rest.toLowerCase(),
            );
        default:
            return text;
    }
}

// Sign, optional fixed currency symbol, a number in either `1,234.56` or `1.234,56` form, optional `%` (ADR-0005).
const regExpNumeric = /^[+-]?[$€£¥]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?)%?$/u;

export function isNumericLike(value: string): boolean {
    return regExpNumeric.test(value.trim());
}

function autoAlign(body: string[][], index: number): AlignType {
    const values = body.map((row) => row[index]?.trim() ?? '').filter((v) => v);
    if (!values.length) return null;
    const numeric = values.filter(isNumericLike).length;
    return numeric / values.length >= autoAlignThreshold ? 'right' : null;
}

function toTextCell(value: string | undefined): TableCell {
    return toCell(value ? [{ type: 'text', value }] : []);
}

function toCell(children: PhrasingContent[]): TableCell {
    return { type: 'tableCell', children };
}

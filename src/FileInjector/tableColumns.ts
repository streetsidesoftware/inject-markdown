import type { AlignType, Nodes } from 'mdast';

import { unquote } from '../util/values.js';
import { parseCellBlocks, parseCellMarkdown } from './cellMarkdown.js';
import type { CellValue } from './Table.js';

export type HeaderFormat = 'none' | 'title' | 'upper' | 'lower';

/** How cell text is rendered, which decides how its plain text is read (ADR-0009 point 1). */
export type CellForm = 'text' | 'markdown' | 'html';

/** One column of the output table. */
export interface OutputColumn {
    /** 0-based source column index. */
    index: number;
    align: AlignType;
    /** `column-names` override, rendered as-is and never formatted (ADR-0007). */
    label?: string | undefined;
}

/** A parsed `columns` entry (ADR-0003). */
export interface ColumnRef {
    ref: number | string;
    align: AlignType | undefined;
}

export interface ColumnLayoutOptions {
    /** Raw `columns` value. */
    columns?: string | undefined;
    /** Raw `column-names` value. */
    columnNames?: string | undefined;
    /** Header rows at the start of `rows`. */
    headerRows: number;
    columnCount: number;
    form: CellForm;
}

/** Share of non-empty data cells that must look numeric for a column to right-align (ADR-0005). */
const autoAlignThreshold = 0.9;

const headerFormats = new Set<string>(['none', 'title', 'upper', 'lower']);

/** Resolve `header-format` (ADR-0006); absent means `none`. Throws on an unknown value. */
export function resolveHeaderFormat(value: string | undefined): HeaderFormat {
    if (value === undefined) return 'none';
    if (!headerFormats.has(value)) {
        throw new Error(`Invalid header-format "${value}": expected none, title, upper or lower.`);
    }
    return value as HeaderFormat;
}

/** Split a comma-separated list whose whole value may be double-quoted (ADR-0001 point 3). */
function splitList(value: string): string[] {
    return unquote(value.trim()).split(',');
}

/** Parse `columns` (ADR-0003). Throws on a missing value or an empty entry. */
export function parseColumnsOption(value: string): ColumnRef[] {
    if (!value.trim()) throw new Error('Invalid columns "": expected a list of column numbers or names.');
    return splitList(value).map((entry) => {
        let ref = entry.trim();
        const left = ref.startsWith(':');
        if (left) ref = ref.slice(1);
        const right = ref.endsWith(':');
        if (right) ref = ref.slice(0, -1);
        ref = normalizeWhitespace(ref);
        if (!ref) throw new Error(`Invalid columns "${value}": empty column reference.`);
        const align: AlignType | undefined = left && right ? 'center' : left ? 'left' : right ? 'right' : undefined;
        return { ref: /^\d+$/.test(ref) ? Number(ref) : ref, align };
    });
}

/** Parse `column-names` (ADR-0007). Throws on a missing value. */
export function parseColumnNamesOption(value: string): string[] {
    if (!value.trim()) throw new Error('Invalid column-names "": expected a list of header labels.');
    return splitList(value).map((name) => name.trim());
}

/**
 * Decide the output columns: selection and order from `columns`, alignment from its markers or
 * auto-alignment, and `column-names` labels. `rows` holds the header rows followed by the data rows
 * already windowed.
 */
export function layoutColumns(rows: CellValue[][], options: ColumnLayoutOptions): OutputColumn[] {
    const { headerRows, columnCount, form } = options;
    const header = rows.slice(0, headerRows);
    const body = rows.slice(headerRows);

    const refs: ColumnRef[] =
        options.columns !== undefined
            ? parseColumnsOption(options.columns)
            : Array.from({ length: columnCount }, (_, i) => ({ ref: i + 1, align: undefined }));
    const labels = options.columnNames !== undefined ? parseColumnNamesOption(options.columnNames) : [];

    let matchStrings: string[] | undefined;

    function resolveIndex(ref: number | string): number {
        if (typeof ref === 'number') {
            if (ref < 1 || ref > columnCount) {
                throw new Error(`Column ${ref} is out of range; the table has ${columnCount} column(s).`);
            }
            return ref - 1;
        }
        if (!headerRows) throw new Error(`Column "${ref}" must be referenced by number when header-rows=0.`);
        // A column's non-empty header cells, space-joined (ADR-0002), in plain text (ADR-0009 point 2).
        matchStrings ??= Array.from({ length: columnCount }, (_, i) =>
            normalizeWhitespace(
                header
                    .map((row) => cellPlainText(row[i], form))
                    .filter((t) => t.trim())
                    .join(' '),
            ),
        );
        const index = matchStrings.indexOf(ref);
        if (index < 0) throw new Error(`Column "${ref}" not found in the table header.`);
        return index;
    }

    const autoAligned = new Map<number, AlignType>();
    function autoAlign(index: number): AlignType {
        let align = autoAligned.get(index);
        if (align === undefined) {
            align = autoAlignColumn(body, index, form);
            autoAligned.set(index, align);
        }
        return align;
    }

    return refs.map(({ ref, align }, i) => {
        const index = resolveIndex(ref);
        return { index, align: align ?? autoAlign(index), label: labels[i] || undefined };
    });
}

function autoAlignColumn(body: CellValue[][], index: number, form: CellForm): AlignType {
    const values = body.map((row) => cellPlainText(row[index], form).trim()).filter((v) => v);
    if (!values.length) return null;
    const numeric = values.filter(isNumericLike).length;
    return numeric / values.length >= autoAlignThreshold ? 'right' : null;
}

// Sign, optional fixed currency symbol, a number as `1,234.56` or `1.234,56`, optional `%` (ADR-0005).
const regExpNumeric = /^[+-]?[$€£¥]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?)%?$/u;

export function isNumericLike(value: string): boolean {
    return regExpNumeric.test(value.trim());
}

function normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/** A cell's plain text (ADR-0009 point 1): its literal text, or the visible text of its Markdown. */
export function cellPlainText(value: CellValue | undefined, form: CellForm): string {
    if (value === undefined) return '';
    if (typeof value !== 'string') return JSON.stringify(value.json);
    switch (form) {
        case 'text':
            return value;
        case 'markdown':
            return nodesPlainText(parseCellMarkdown(value), '');
        case 'html':
            return nodesPlainText(parseCellBlocks(value), ' ');
    }
}

const regExpBr = /^<br\s*\/?>$/i;

/** Parents whose children are blocks, so adjacent children are separated by a space. */
const blockParents = new Set(['root', 'blockquote', 'list', 'listItem', 'footnoteDefinition']);

function nodesPlainText(nodes: Nodes[], separator: string): string {
    return nodes.map(nodePlainText).join(separator);
}

function nodePlainText(node: Nodes): string {
    switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'code':
            return node.value;
        case 'image':
            return node.alt ?? '';
        case 'html':
            return regExpBr.test(node.value.trim()) ? ' ' : '';
        case 'break':
            return ' ';
    }
    if ('children' in node) {
        return nodesPlainText(node.children as Nodes[], blockParents.has(node.type) ? ' ' : '');
    }
    return '';
}

/** Change the case of header text (ADR-0006). */
export function formatHeaderText(text: string, format: HeaderFormat): string {
    switch (format) {
        case 'upper':
            return text.toUpperCase();
        case 'lower':
            return text.toLowerCase();
        case 'title':
            return titleCase(text, { atWordStart: true });
        default:
            return text;
    }
}

interface TitleState {
    atWordStart: boolean;
}

/** Capitalize the first letter of each whitespace-separated word and lowercase the rest. */
function titleCase(text: string, state: TitleState): string {
    let result = '';
    for (const c of text) {
        const isSpace = /\s/.test(c);
        result += isSpace ? c : state.atWordStart ? c.toUpperCase() : c.toLowerCase();
        state.atWordStart = isSpace;
    }
    return result;
}

/**
 * Apply `header-format` to the `text` nodes of a parsed header cell, in place (ADR-0009 point 4).
 * Inline code, code, raw HTML, URLs and alt text are left as written. Title-case word state carries
 * across adjacent text nodes and restarts at each paragraph or heading.
 */
export function formatHeaderNodes(nodes: Nodes[], format: HeaderFormat): void {
    if (format === 'none') return;
    const state: TitleState = { atWordStart: true };
    function visit(node: Nodes) {
        if (node.type === 'paragraph' || node.type === 'heading') state.atWordStart = true;
        if (node.type === 'text') {
            node.value = format === 'title' ? titleCase(node.value, state) : formatHeaderText(node.value, format);
            return;
        }
        if ('children' in node) (node.children as Nodes[]).forEach(visit);
    }
    nodes.forEach(visit);
}

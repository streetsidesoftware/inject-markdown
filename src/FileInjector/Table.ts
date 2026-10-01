import type { AlignType, Html, PhrasingContent, RootContent, Table, TableCell, TableRow } from 'mdast';

import { parseCellBlocks, parseCellMarkdown } from './cellMarkdown.js';
import { formatHeaderNodes, type HeaderFormat, type OutputColumn } from './tableColumns.js';

/** A nested JSON object or array, rendered per table form (ADR-0011 point 5). */
export interface JsonCell {
    json: object;
}

/** A table cell's source: text, or a nested JSON value from a JSON table source. */
export type CellValue = string | JsonCell;

export function isJsonCell(value: unknown): value is JsonCell {
    return typeof value === 'object' && value !== null && 'json' in value;
}

export interface HeaderRowsOption {
    /** Leading rows that form the header; default 1. See ADR-0002. */
    headerRows?: number | undefined;
    /** Column count when `rows` can't supply it, e.g. no header and an empty row window. */
    columnCount?: number | undefined;
}

export interface ColumnOptions {
    /** Output columns in order, with alignment and labels. Every source column when absent. */
    columns?: OutputColumn[] | undefined;
    /** Case change applied to header text. */
    headerFormat?: HeaderFormat | undefined;
}

export interface RowsToTableOptions extends HeaderRowsOption, ColumnOptions {
    /** Parse cell text as inline Markdown instead of literal text. See ADR-0008. */
    markdown?: boolean | undefined;
}

/**
 * Convert parsed rows into a GFM table. The first `headerRows` rows are joined per column into the
 * single GFM header row with `<br />`; with none, the header is the column numbers (ADR-0002).
 */
export function rowsToTable(rows: CellValue[][], options: RowsToTableOptions = {}): Table {
    const columns = options.columns ?? allColumns(options.columnCount ?? widestRow(rows));
    const headerFormat = options.headerFormat ?? 'none';

    function toChildren(value: CellValue | undefined): PhrasingContent[] {
        if (isJsonCell(value)) {
            const text = JSON.stringify(value.json);
            return [options.markdown ? { type: 'inlineCode', value: text } : { type: 'text', value: text }];
        }
        if (!value) return [];
        return options.markdown ? parseCellMarkdown(value) : [{ type: 'text', value }];
    }

    function toCell(value: CellValue | undefined): TableCell {
        return { type: 'tableCell', children: toChildren(value) };
    }

    /** One header cell from a column's non-empty header-row cells, each formatted, joined with `<br />`. */
    function toHeaderCell(column: number): TableCell {
        const parts = header.map((row) => row[column]).filter((v): v is CellValue => !!v);
        const children = parts.flatMap((part, i): PhrasingContent[] => {
            const nodes = toChildren(part);
            formatHeaderNodes(nodes, headerFormat);
            return [...(i ? [{ type: 'html', value: '<br />' } as const] : []), ...nodes];
        });
        return { type: 'tableCell', children };
    }

    function toHeaderRow(): TableRow {
        const children = columns.map(({ index, label }) =>
            // A label replaces the header text and is not case-formatted.
            label ? toCell(label) : header.length ? toHeaderCell(index) : toCell(String(index + 1)),
        );
        return { type: 'tableRow', children };
    }

    function toTableRow(cells: CellValue[]): TableRow {
        return { type: 'tableRow', children: columns.map(({ index }) => toCell(cells[index])) };
    }

    const { header, body } = splitHeader(rows, options.headerRows);

    return {
        type: 'table',
        align: columns.map(({ align }) => align),
        children: [toHeaderRow(), ...body.map(toTableRow)],
    };
}

/**
 * Convert parsed rows into an HTML `<table>` whose cells hold Markdown (ADR-0010). The first
 * `headerRows` rows (default 1) each become a `<thead>` row; with none there is no `<thead>`.
 * Returns sibling nodes: `html` nodes for the tags, interleaved with the parsed
 * blocks of each cell that has markup. The blank line remark-stringify puts between siblings is what
 * lets a renderer parse that Markdown.
 */
export function rowsToHtmlTable(rows: CellValue[][], options: HeaderRowsOption & ColumnOptions = {}): RootContent[] {
    const columns = options.columns ?? allColumns(options.columnCount ?? widestRow(rows));
    const headerFormat = options.headerFormat ?? 'none';
    const nodes: RootContent[] = [];
    let html = '';

    function flush() {
        if (!html) return;
        const node: Html = { type: 'html', value: html.replace(/\n$/, '') };
        nodes.push(node);
        html = '';
    }

    function addCell(tag: 'th' | 'td', value: CellValue | undefined, align: AlignType, format: HeaderFormat) {
        const blocks: RootContent[] = isJsonCell(value)
            ? [{ type: 'code', lang: 'json', value: JSON.stringify(value.json, null, 2) }]
            : value
              ? parseCellBlocks(value)
              : [];
        formatHeaderNodes(blocks, format);
        // Alignment is an attribute on every cell of the column.
        const open = align ? `<${tag} align="${align}">` : `<${tag}>`;
        const plain = plainParagraphText(blocks);
        if (plain !== undefined) {
            html += `${open}${escapeHtml(plain)}</${tag}>\n`;
            return;
        }
        html += open;
        flush();
        nodes.push(...blocks);
        html = `</${tag}>\n`;
    }

    /**
     * `labels` decides what a labelled column shows in a header row.
     * - `label`: its label. Used for the last header row.
     * - `blank`: nothing. Used for the header rows above it.
     */
    function addRow(tag: 'th' | 'td', cells: CellValue[] | undefined, labels?: 'label' | 'blank') {
        html += '<tr>\n';
        for (const { index, align, label } of columns) {
            if (labels && label) addCell(tag, labels === 'label' ? label : '', align, 'none');
            else addCell(tag, cells?.[index], align, tag === 'th' ? headerFormat : 'none');
        }
        html += '</tr>\n';
    }

    const { header, body } = splitHeader(rows, options.headerRows);
    const hasLabels = columns.some(({ label }) => label);

    html += '<table>\n';
    // Each header row is a real row.
    // With no header rows there is no `<thead>`, unless there are labels to show.
    if (header.length || hasLabels) {
        html += '<thead>\n';
        header.slice(0, -1).forEach((row) => addRow('th', row, 'blank'));
        // With no header rows, this is a row of labels only.
        addRow('th', header.at(-1), 'label');
        html += '</thead>\n';
    }
    html += '<tbody>\n';
    body.forEach((row) => addRow('td', row));
    html += '</tbody>\n</table>\n';
    flush();
    return nodes;
}

function allColumns(columnCount: number): OutputColumn[] {
    return Array.from({ length: columnCount }, (_, index) => ({ index, align: null }));
}

export function widestRow(rows: unknown[][]): number {
    return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/** The leading `headerRows` rows (default 1) and the rest. An empty source keeps one empty header row. */
function splitHeader(rows: CellValue[][], headerRows = 1): { header: CellValue[][]; body: CellValue[][] } {
    if (!rows.length) return { header: headerRows ? [[]] : [], body: [] };
    return { header: rows.slice(0, headerRows), body: rows.slice(headerRows) };
}

/**
 * The text of a cell that can stay on one line: empty, or a single paragraph of plain text with no
 * line break (ADR-0010 point 8). `undefined` means the cell has markup and must be blank-line wrapped.
 */
function plainParagraphText(blocks: RootContent[]): string | undefined {
    if (!blocks.length) return '';
    const [first] = blocks;
    if (blocks.length !== 1 || first.type !== 'paragraph') return undefined;
    if (!first.children.every((n) => n.type === 'text')) return undefined;
    const text = first.children.map((n) => n.value).join('');
    return text.includes('\n') ? undefined : text;
}

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

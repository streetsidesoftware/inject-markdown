import type { Html, PhrasingContent, RootContent, Table, TableCell, TableRow } from 'mdast';

import { parseCellBlocks, parseCellMarkdown } from './cellMarkdown.js';

/** A nested JSON object or array, rendered per table form (ADR-0011 point 5). */
export interface JsonCell {
    json: object;
}

/** A table cell's source: text, or a nested JSON value from a JSON table source. */
export type CellValue = string | JsonCell;

export function isJsonCell(value: CellValue | undefined): value is JsonCell {
    return typeof value === 'object';
}

export interface HeaderRowsOption {
    /** Leading rows that form the header; default 1. See ADR-0002. */
    headerRows?: number | undefined;
}

export interface RowsToTableOptions extends HeaderRowsOption {
    /** Parse cell text as inline Markdown instead of literal text. See ADR-0008. */
    markdown?: boolean | undefined;
}

/**
 * Convert parsed rows into a GFM table. The first `headerRows` rows are joined per column into the
 * single GFM header row with `<br />`; with none, the header is the column numbers (ADR-0002).
 */
export function rowsToTable(rows: CellValue[][], options: RowsToTableOptions = {}): Table {
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

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

    /** One header cell from a column's non-empty header-row cells, joined with `<br />`. */
    function toHeaderCell(column: number): TableCell {
        const parts = header.map((row) => row[column]).filter((v): v is CellValue => !!v);
        const children = parts.flatMap((part, i): PhrasingContent[] => [
            ...(i ? [{ type: 'html', value: '<br />' } as const] : []),
            ...toChildren(part),
        ]);
        return { type: 'tableCell', children };
    }

    function toHeaderRow(): TableRow {
        const children: TableCell[] = [];
        for (let i = 0; i < columnCount; ++i) {
            children.push(header.length ? toHeaderCell(i) : toCell(String(i + 1)));
        }
        return { type: 'tableRow', children };
    }

    function toTableRow(cells: CellValue[]): TableRow {
        const children: TableCell[] = [];
        for (let i = 0; i < columnCount; ++i) {
            children.push(toCell(cells[i]));
        }
        return { type: 'tableRow', children };
    }

    const { header, body } = splitHeader(rows, options.headerRows);

    return {
        type: 'table',
        align: new Array(columnCount).fill(null),
        children: [toHeaderRow(), ...body.map(toTableRow)],
    };
}

/**
 * Convert parsed rows into an HTML `<table>` whose cells hold Markdown (ADR-0010), using the first
 * row as the header. Returns sibling nodes: `html` nodes for the tags, interleaved with the parsed
 * blocks of each cell that has markup. The blank line remark-stringify puts between siblings is what
 * lets a renderer parse that Markdown.
 */
export function rowsToHtmlTable(rows: CellValue[][], options: HeaderRowsOption = {}): RootContent[] {
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const nodes: RootContent[] = [];
    let html = '';

    function flush() {
        if (!html) return;
        const node: Html = { type: 'html', value: html.replace(/\n$/, '') };
        nodes.push(node);
        html = '';
    }

    function addCell(tag: 'th' | 'td', value: CellValue | undefined) {
        const blocks: RootContent[] = isJsonCell(value)
            ? [{ type: 'code', lang: 'json', value: JSON.stringify(value.json, null, 2) }]
            : value
              ? parseCellBlocks(value)
              : [];
        const plain = plainParagraphText(blocks);
        if (plain !== undefined) {
            html += `<${tag}>${escapeHtml(plain)}</${tag}>\n`;
            return;
        }
        html += `<${tag}>`;
        flush();
        nodes.push(...blocks);
        html = `</${tag}>\n`;
    }

    function addRow(tag: 'th' | 'td', cells: CellValue[]) {
        html += '<tr>\n';
        for (let i = 0; i < columnCount; ++i) {
            addCell(tag, cells[i]);
        }
        html += '</tr>\n';
    }

    const { header, body } = splitHeader(rows, options.headerRows);

    html += '<table>\n';
    // Each header row is a real row; with none there is no `<thead>` (ADR-0010 point 4).
    if (header.length) {
        html += '<thead>\n';
        header.forEach((row) => addRow('th', row));
        html += '</thead>\n';
    }
    html += '<tbody>\n';
    body.forEach((row) => addRow('td', row));
    html += '</tbody>\n</table>\n';
    flush();
    return nodes;
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

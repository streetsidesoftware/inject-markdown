import type { Html, PhrasingContent, RootContent, Table, TableCell, TableRow } from 'mdast';

import { parseCellBlocks, parseCellMarkdown } from './cellMarkdown.js';

export interface RowsToTableOptions {
    /** Parse cell text as inline Markdown instead of literal text. See ADR-0008. */
    markdown?: boolean | undefined;
}

/**
 * Convert parsed rows into a GFM table, using the first row as the header.
 */
export function rowsToTable(rows: string[][], options: RowsToTableOptions = {}): Table {
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    function toCell(value: string | undefined): TableCell {
        const children: PhrasingContent[] = !value
            ? []
            : options.markdown
              ? parseCellMarkdown(value)
              : [{ type: 'text', value }];
        return { type: 'tableCell', children };
    }

    function toTableRow(cells: string[]): TableRow {
        const children: TableCell[] = [];
        for (let i = 0; i < columnCount; ++i) {
            children.push(toCell(cells[i]));
        }
        return { type: 'tableRow', children };
    }

    const [header, ...body] = rows.length ? rows : [[]];

    return {
        type: 'table',
        align: new Array(columnCount).fill(null),
        children: [toTableRow(header), ...body.map(toTableRow)],
    };
}

/**
 * Convert parsed rows into an HTML `<table>` whose cells hold Markdown (ADR-0010), using the first
 * row as the header. Returns sibling nodes: `html` nodes for the tags, interleaved with the parsed
 * blocks of each cell that has markup. The blank line remark-stringify puts between siblings is what
 * lets a renderer parse that Markdown.
 */
export function rowsToHtmlTable(rows: string[][]): RootContent[] {
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const nodes: RootContent[] = [];
    let html = '';

    function flush() {
        if (!html) return;
        const node: Html = { type: 'html', value: html.replace(/\n$/, '') };
        nodes.push(node);
        html = '';
    }

    function addCell(tag: 'th' | 'td', value: string | undefined) {
        const blocks = value ? parseCellBlocks(value) : [];
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

    function addRow(tag: 'th' | 'td', cells: string[]) {
        html += '<tr>\n';
        for (let i = 0; i < columnCount; ++i) {
            addCell(tag, cells[i]);
        }
        html += '</tr>\n';
    }

    const [header, ...body] = rows.length ? rows : [[]];

    html += '<table>\n<thead>\n';
    addRow('th', header);
    html += '</thead>\n<tbody>\n';
    body.forEach((row) => addRow('td', row));
    html += '</tbody>\n</table>\n';
    flush();
    return nodes;
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

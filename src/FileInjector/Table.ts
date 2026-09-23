import type { PhrasingContent, Table, TableCell, TableRow } from 'mdast';

import { parseCellMarkdown } from './cellMarkdown.js';

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

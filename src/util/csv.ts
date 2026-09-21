/**
 * Parse delimited text (CSV/TSV) into rows of string fields.
 * Supports RFC 4180 style quoting: `"` quoted fields, doubled `""` as an escaped quote,
 * and quoted fields containing the delimiter or newlines.
 */
export function parseDelimitedText(content: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    function pushField() {
        row.push(field);
        field = '';
    }

    function pushRow() {
        pushField();
        rows.push(row);
        row = [];
    }

    for (let i = 0; i < content.length; ++i) {
        const c = content[i];
        if (inQuotes) {
            if (c === '"') {
                if (content[i + 1] === '"') {
                    field += '"';
                    ++i;
                    continue;
                }
                inQuotes = false;
                continue;
            }
            field += c;
            continue;
        }
        if (c === '"' && !field) {
            inQuotes = true;
            continue;
        }
        if (c === delimiter) {
            pushField();
            continue;
        }
        if (c === '\r') continue;
        if (c === '\n') {
            pushRow();
            continue;
        }
        field += c;
    }
    if (field || row.length) {
        pushRow();
    }

    return rows;
}

/**
 * Map a file extension (including the leading `.`) to the delimiter
 * used to split its columns.
 */
export function delimiterForExtension(ext: string): string {
    return ext.toLowerCase() === '.tsv' ? '\t' : ',';
}

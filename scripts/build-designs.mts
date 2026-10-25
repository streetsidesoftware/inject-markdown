#!/usr/bin/env node
// Writes docs/designs/static/designs.json, the data for the designs index: one row per design folder.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

import { inlineCode, link } from 'inject-markdown/markdown';

/** One row of the designs index. Its keys are the table's column headers. */
interface DesignRow {
    Design: string;
    Title: string;
}

const designsDir = new URL('../docs/designs/', import.meta.url);
const staticDir = new URL('static/', designsDir);

const entries = await readdir(designsDir, { withFileTypes: true });
const slugs = entries
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/README.md`, designsDir)))
    .map((entry) => entry.name)
    .sort();

const rows: DesignRow[] = [];
for (const slug of slugs) {
    const content = await readFile(new URL(`${slug}/README.md`, designsDir), 'utf8');
    const title = /^# (.+)$/m.exec(content)?.[1].trim() ?? '';
    rows.push({ Design: link(inlineCode(slug), `../${slug}/README.md`).toString(), Title: title });
}

await mkdir(staticDir, { recursive: true });
await writeFile(new URL('designs.json', staticDir), JSON.stringify(rows, null, 2) + '\n');

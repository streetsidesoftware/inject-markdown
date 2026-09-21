import { parseHash } from '../util/hash.js';
import { parseRelativeUrl, type RelURL } from '../util/url_helper.js';

const injectDirectiveRegExp = /^[ \t]*<!--+\s*@@inject(?<type>|-start|-end|-code|-table)[:\s]\s*(?<file>.*?)-+->$/;

export type DirectiveType = 'start' | 'end' | 'code' | 'table';

export interface Directive {
    type: DirectiveType;
    file: RelURL | undefined;
}

/** File extensions that default to a table injection instead of a code block. */
const tableFileExtensions = new Set(['.csv', '.tsv']);

export function parseDirective(html: string): Directive | undefined {
    const m = html.match(injectDirectiveRegExp);
    if (!m || !m.groups) return undefined;

    const filePath = m.groups['file'].trim();
    const file = (filePath && parseRelativeUrl(filePath)) || undefined;
    const typeGroup = m.groups['type'];
    const isEnd = typeGroup === '-end';
    const isExplicitCode = typeGroup === '-code';
    const isExplicitTable = typeGroup === '-table';
    const isMarkdownFile = !!file?.pathname.toLowerCase().endsWith('.md');
    const isTableFile = !!file && tableFileExtensions.has(fileExtension(file.pathname));

    // A `#lang=`/`#code=` option is an explicit request for a code block, which
    // overrides the default table behavior for `.csv`/`.tsv` files (but not an
    // explicit `@@inject-table` directive).
    const isTable = !isEnd && (isExplicitTable || (!isExplicitCode && isTableFile && !hasExplicitLang(file)));
    const isCode = !isEnd && !isTable && (isExplicitCode || !isMarkdownFile);

    const d: Directive = {
        type: isEnd ? 'end' : isTable ? 'table' : isCode ? 'code' : 'start',
        file,
    };
    return d;
}

function hasExplicitLang(file: RelURL | undefined): boolean {
    return !!file && parseHash(file).lang !== undefined;
}

function fileExtension(pathname: string): string {
    const p = pathname.toLowerCase();
    const dotIdx = p.lastIndexOf('.');
    const slashIdx = p.lastIndexOf('/');
    return dotIdx > slashIdx ? p.slice(dotIdx) : '';
}

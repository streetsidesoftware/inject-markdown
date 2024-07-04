import { parseRelativeUrl, type RelURL } from '../util/url_helper.js';

const injectDirectiveRegExp = /^[ \t]*<!--+\s*@@inject(?<type>|-start|-end|-code)[:\s]\s*(?<file>.*?)-+->$/;

export type DirectiveType = 'start' | 'end' | 'code';

export interface Directive {
    type: DirectiveType;
    file: RelURL | undefined;
}

export function parseDirective(html: string): Directive | undefined {
    const m = html.match(injectDirectiveRegExp);
    if (!m || !m.groups) return undefined;

    const filePath = m.groups['file'].trim();
    const file = (filePath && parseRelativeUrl(filePath)) || undefined;
    const isEnd = m.groups['type'] === '-end';
    const isCode = (!isEnd && !file?.pathname.toLowerCase().endsWith('.md')) || m.groups['type'] === '-code';

    const d: Directive = {
        type: isEnd ? 'end' : isCode ? 'code' : 'start',
        file,
    };
    return d;
}

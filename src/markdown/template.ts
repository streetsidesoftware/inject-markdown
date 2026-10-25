import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import type { MDInlineTemplate, MDTemplate, MDText, MDValue } from './builders.js';
import { detectMarkdownStyle } from './detectStyle.js';
import {
    blockNodes,
    describe,
    inlineNodes,
    isBlockContent,
    isKind,
    MarkdownValue,
    renderingOf,
    textNodes,
} from './nodes.js';
import { placeholderRegExp } from './placeholders.js';

/** A value a template placeholder can take. */
export type TemplateValue = string | number | boolean | MDValue | readonly TemplateValue[];

/**
 * The values for a template.
 * - A top-level key may be a dotted name, such as `'engines.cspell'`.
 * - A nested object is walked one segment at a time.
 * - When several keys could supply a name, the later key wins.
 */
export interface TemplateValues {
    readonly [name: string]: TemplateValue | TemplateValues | undefined;
}

/**
 * Fill a Markdown template's `{@ name @}` placeholders.
 * - A string is inserted as text and escaped.
 * - A placeholder inside a line takes only inline values.
 * - A placeholder that stands alone as its own paragraph also takes blocks.
 * - A placeholder inside inline code or a code block takes only a string or text, inserted as is.
 *
 * The result renders in the template's own style.
 * @throws if a placeholder has no value, or a value doesn't fit where its placeholder is.
 */
export function template(markdown: string, values: TemplateValues): MDTemplate {
    const root = parse(markdown, false);
    fill(root, values, true);
    return new MarkdownValue('block', 'a template', root.children, detectMarkdownStyle(root, markdown));
}

/**
 * Fill an inline template, for use inside a line.
 * The text must be one paragraph. Block syntax, such as a leading `-`, is read as text.
 * @throws if the text isn't one paragraph, a placeholder has no value, or a value isn't inline.
 */
export function inlineTemplate(markdown: string, values: TemplateValues): MDInlineTemplate {
    const start = markdown.trimStart();
    const lead = markdown.slice(0, markdown.length - start.length);
    const body = start.trimEnd();
    const tail = start.slice(body.length);
    const root = parse(body, true);
    if (root.children.length > 1 || (root.children[0] && root.children[0].type !== 'paragraph')) {
        throw new Error('inline template text must be one paragraph');
    }
    fill(root, values, false);
    const children = root.children[0]?.type === 'paragraph' ? root.children[0].children : [];
    return new MarkdownValue('inline', 'an inline template', [...textNodes(lead), ...children, ...textNodes(tail)]);
}

/**
 * Block constructs, turned off when parsing an inline template.
 * The names are micromark's construct names.
 */
const blockConstructs = [
    'blockQuote',
    'codeFenced',
    'codeIndented',
    'definition',
    'gfmFootnoteDefinition',
    'headingAtx',
    'htmlFlow',
    'list',
    'setextUnderline',
    'table',
    'thematicBreak',
];

function parse(markdown: string, inline: boolean): Root {
    const processor = unified().use(remarkParse).use(remarkGfm);
    if (inline) {
        processor.use(function disableBlocks() {
            const data = this.data();
            (data.micromarkExtensions ??= []).push({ disable: { null: blockConstructs } });
        });
    }
    return processor.parse(markdown);
}

/**
 * Look up a placeholder name.
 * Each top-level key acts as a declaration, and the newest one wins:
 * - Keys are tried from last to first.
 * - A key matches when it equals the name, or a leading part of it whose rest resolves inside its value.
 * - A key that doesn't supply the name doesn't stop the search.
 */
export function resolveValue(values: TemplateValues, name: string): TemplateValue | undefined {
    const keys = Object.keys(values);
    for (let i = keys.length - 1; i >= 0; --i) {
        const key = keys[i];
        const value =
            key === name
                ? values[key]
                : name.startsWith(key + '.')
                  ? walk(values[key], name.slice(key.length + 1))
                  : undefined;
        if (isTemplateValue(value)) return value;
    }
    return undefined;
}

/** Walk a dotted name into nested objects, one segment per level. Only own properties count. */
function walk(value: unknown, name: string): unknown {
    let cur = value;
    for (const segment of name.split('.')) {
        if (!isPlainObject(cur) || !Object.hasOwn(cur, segment)) return undefined;
        cur = cur[segment];
    }
    return cur;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !renderingOf(value);
}

function isTemplateValue(value: unknown): value is TemplateValue {
    const t = typeof value;
    return (
        t === 'string' || t === 'number' || t === 'boolean' || renderingOf(value) !== undefined || Array.isArray(value)
    );
}

/**
 * Replace the placeholders in a parsed template, in place.
 * @param allowBlocks - a placeholder alone in its paragraph may take blocks.
 */
function fill(root: Root, values: TemplateValues, allowBlocks: boolean): void {
    const missing = new Set<string>();

    const lookup = (name: string): TemplateValue | undefined => {
        const value = resolveValue(values, name);
        if (value === undefined) missing.add(name);
        return value;
    };

    const fillText = (text: string): PhrasingContent[] => {
        const nodes: PhrasingContent[] = [];
        let last = 0;
        for (const match of text.matchAll(placeholderRegExp)) {
            const [whole, escape, name] = match;
            if (match.index > last) nodes.push({ type: 'text', value: text.slice(last, match.index) });
            last = match.index + whole.length;
            const value = escape ? undefined : lookup(name);
            if (value === undefined) {
                nodes.push({ type: 'text', value: escape ? whole.slice(1) : whole });
                continue;
            }
            nodes.push(...valueAsInline(value, name));
        }
        if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
        return nodes;
    };

    const fillCode = (code: string): string =>
        code.replace(placeholderRegExp, (whole, escape: string | undefined, name: string) => {
            if (escape) return whole.slice(1);
            const value = lookup(name);
            return value === undefined ? whole : valueAsCode(value, name);
        });

    /** The blocks for a paragraph that is only a placeholder whose value is blocks. */
    const standaloneBlocks = (node: RootContent): RootContent[] | undefined => {
        if (!allowBlocks || node.type !== 'paragraph' || node.children.length !== 1) return undefined;
        const only = node.children[0];
        if (only.type !== 'text') return undefined;
        const trimmed = only.value.trim();
        const matches = [...trimmed.matchAll(placeholderRegExp)];
        const [whole, escape, name] = matches[0] ?? [];
        if (matches.length !== 1 || escape || whole !== trimmed || !name) return undefined;
        const value = resolveValue(values, name);
        return isBlockContent(value) ? blockNodes(value, `{@ ${name} @}`) : undefined;
    };

    const fillParent = (parent: Parent): void => {
        const children: RootContent[] = [];
        for (const child of parent.children) {
            const blocks = standaloneBlocks(child);
            if (blocks) {
                children.push(...blocks);
                continue;
            }
            switch (child.type) {
                case 'text':
                    children.push(...fillText(child.value));
                    continue;
                case 'inlineCode':
                case 'code':
                case 'html':
                    child.value = fillCode(child.value);
                    break;
                default:
                    if ('children' in child) fillParent(child);
            }
            children.push(child);
        }
        parent.children = children;
    };

    fillParent(root);

    if (missing.size) {
        const names = [...missing].map((name) => `{@ ${name} @}`).join(', ');
        throw new Error(`template has no value for ${names}`);
    }
}

function valueAsInline(value: TemplateValue, name: string): PhrasingContent[] {
    if (typeof value === 'number' || typeof value === 'boolean') return textNodes(String(value));
    return inlineNodes(value, `{@ ${name} @}`);
}

/** A value inside code: only a string or text, inserted as is. */
function valueAsCode(value: TemplateValue, name: string): string {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (isText(value)) return value.text;
    throw new TypeError(`{@ ${name} @} is inside code and takes only a string or text, got ${describe(value)}`);
}

function isText(value: unknown): value is MDText {
    return isKind(value, 'inline') && value.description === 'text';
}

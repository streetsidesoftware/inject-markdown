import type { Link, PhrasingContent, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import type { Processor } from 'unified';
import { unified } from 'unified';

/**
 * micromark flow (block) constructs switched off for cell parsing, so block syntax such as
 * `# Title` or `- item` falls through to a plain paragraph and renders literally (ADR-0008 point 5).
 */
const disabledBlockConstructs = [
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

function remarkInlineOnly(this: Processor) {
    const data = this.data();
    const extensions = (data.micromarkExtensions ??= []);
    extensions.push({ disable: { null: disabledBlockConstructs } });
}

let processor: ReturnType<typeof createProcessor> | undefined;
let blockProcessor: ReturnType<typeof createBlockProcessor> | undefined;

function createProcessor() {
    return unified().use(remarkParse).use(remarkGfm).use(remarkInlineOnly);
}

function createBlockProcessor() {
    return unified().use(remarkParse).use(remarkGfm);
}

/**
 * Parse a table cell's text as a standalone Markdown document, blocks included (ADR-0010 point 6).
 */
export function parseCellBlocks(value: string): RootContent[] {
    blockProcessor ??= createBlockProcessor();
    return blockProcessor.parse(value).children;
}

/**
 * Parse a table cell's text as inline GFM Markdown (ADR-0008).
 * Each line is parsed on its own; line breaks become `<br />` (point 7).
 */
export function parseCellMarkdown(value: string): PhrasingContent[] {
    processor ??= createProcessor();
    const result: PhrasingContent[] = [];
    const lines = value.split(/\r?\n/);
    for (let i = 0; i < lines.length; ++i) {
        if (i) result.push({ type: 'html', value: '<br />' });
        result.push(...parseLine(processor, lines[i]));
    }
    return result;
}

function parseLine(p: ReturnType<typeof createProcessor>, line: string): PhrasingContent[] {
    const root = p.parse(line);
    const [first] = root.children;
    if (!first) return [];
    // Flow constructs are disabled, so a non-empty line is always a single paragraph.
    if (root.children.length === 1 && first.type === 'paragraph') return first.children.map(escapePipes);
    return [{ type: 'text', value: line }];
}

/**
 * Keep a `|` from splitting the cell (ADR-0008 point 6). remark-stringify escapes it in text,
 * code and resource links, but not in raw HTML or autolinks.
 */
function escapePipes(node: PhrasingContent): PhrasingContent {
    if (node.type === 'html') return { ...node, value: node.value.replaceAll('|', '\\|') };
    if (node.type === 'link' && isAutolink(node) && node.url.includes('|')) {
        // Percent-encoding the URL makes it differ from its text, so it is written as `[text](url)`.
        return { ...node, url: node.url.replaceAll('|', '%7C') };
    }
    if ('children' in node) {
        return { ...node, children: node.children.map(escapePipes) } as PhrasingContent;
    }
    return node;
}

/** A link mdast-util-to-markdown may write as `<url>` (its `formatLinkAsAutolink` text/URL match). */
function isAutolink(node: Link): boolean {
    const [child] = node.children;
    if (node.title || node.children.length !== 1 || child.type !== 'text') return false;
    return child.value === node.url || 'mailto:' + child.value === node.url;
}

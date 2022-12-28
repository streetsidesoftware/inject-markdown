import assert from 'assert';
import type { Content, HTML, Root, Parent } from 'mdast';
import * as path from 'node:path';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { is } from 'unist-util-is';
import { remove } from 'unist-util-remove';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';
import { reporter } from 'vfile-reporter';
import { parentPort } from 'worker_threads';

import { BufferEncoding, FileSystemAdapter, PathLike } from './FileSystemAdapter.js';

type Node = Root | Content;

// const injectStartRegExp = /^[ \t]*<!---?\s*@@inject(?:-start)?:/gm;
// const injectEndRegExp = /^[ \t]*<!---?\s*@@inject-end:/gm;
// const injectDisable = /@@inject-disable\b/g;
// const injectEnable = /@@inject-enable\b/g;

const injectDirectiveRegExp = /^[ \t]*<!---?\s*@@inject(?<type>|-start|-end):\s*(?<file>.*?)-?-->$/;

// const commentStart = '<!---';
// const commentEnd = '-->';

const directiveRegExp = /^[ \t]*<!---?\s*@@inject\b/;

const directivePrefix = '@@inject';

export interface FileInjectorOptions {
    /** optional output directory */
    outputDir?: string;
    /** Current working directory */
    cwd?: string;
    /** Only clean the file, do not inject */
    cleanOnly?: boolean;
}

export class FileInjector {
    constructor(readonly fs: FileSystemAdapter, readonly options: FileInjectorOptions) {}

    /**
     * Process all injections for a file.
     * @param filePath - path to file to process
     * @param encoding - file encoding
     * @returns true if changed, otherwise false.
     */
    async processFile(filePath: PathLike, encoding: BufferEncoding = 'utf8'): Promise<boolean> {
        const file = await readFile(this.fs, filePath, encoding);
        return processFileInjections(file, this.fs, this.options);
    }
}

function processFileInjections(file: VFile, fs: FileSystemAdapter, options: FileInjectorOptions): Promise<boolean> {
    return __processFile();

    async function __processFile(): Promise<boolean> {
        const fileValue = file.value;
        const content = extractContent(file);
        const lineEnding = detectLineEnding(content);
        const result = await processFileContent();
        if (result.value === fileValue) {
            options.outputDir && (await writeResult(result));
            return false;
        }
        console.log(reporter(result));
        const resultAsString = extractContent(result);
        const resultContent = fixContentLineEndings(resultAsString, lineEnding, hasEofNewLine(content));
        if (content === resultContent) {
            options.outputDir && (await writeResult(result));
            return false;
        }
        await writeResult(result);
        return true;
    }

    async function writeResult(file: VFile): Promise<void> {
        const content = extractContent(file);
        const filePath = determineTargetPath(file);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        return fs.writeFile(filePath, content, getEncoding(file));
    }

    function determineTargetPath(file: VFile): string {
        const outDir = options.outputDir;
        if (!outDir) return file.path;

        const cwd = path.resolve(options.cwd || file.cwd);
        const srcPath = path.resolve(cwd, file.path);
        const relPath = path.relative(cwd, srcPath);

        return path.join(path.resolve(outDir), relPath);
    }

    async function processFileContent(): Promise<VFile> {
        if (!extractContent(file).includes(directivePrefix)) {
            return file;
        }
        const result = await unified().use(remarkParse).use(processInjections).use(remarkStringify).process(file);
        return result;
    }

    function processInjections() {
        return async (root: Root, file: VFile): Promise<Root> => {
            root = deleteInjectedContent(root, file);
            if (options.cleanOnly) return root;
            root = await injectFiles(root);
            return root;
        };
    }

    async function injectFiles(root: Root): Promise<Root> {
        const directiveNodes = collectInjectionNodes(root);

        for (const node of directiveNodes) {
            if (!node.file) continue;
            await injectFile(node);
        }

        return root;
    }

    async function injectFile(directive: DirectiveNode): Promise<void> {
        if (!directive.file || directive.type !== 'start') return;
        const [encodedName, header] = directive.file.split('#', 2);
        const fileName = decodeURI(encodedName);
        console.log(fileName);

        const parent = directive.parent;
        const index = parent.children.indexOf(directive.node);
        assert(index >= 0);
        const addStart = directive.node.value.includes('@@inject-start');
        const root = await readAndParseMarkdownFile(fileName, header);
        remove(root, (n: Node) => isHtmlNode(n) && n.value.includes('@@inject'));
        const encodedFile = encodeURI(fileName) + (header ? '#' + encodeURIComponent(header) : '');
        const start: HTML = {
            type: 'html',
            value: `<!--- @@inject${addStart ? '-start' : ''}: ${encodedFile} --->`,
        };
        const end: HTML = {
            type: 'html',
            value: `<!--- @@inject-end: ${encodedFile} --->`,
        };
        parent.children.splice(index, 1, start, ...root.children, end);
    }

    async function readAndParseMarkdownFile(fileName: string, _atHeader: string | undefined): Promise<Root> {
        const dir = file.dirname || process.cwd();
        const resolvedFile = path.resolve(dir, fileName);
        try {
            const vFile = await readFile(fs, resolvedFile);
            return parseMarkdownFile(vFile);
        } catch (e) {
            file.message(e as Error);
            return unified().use(remarkParse).parse(`\
<!---
  Failed to read "${fileName}"
--->`);
        }
    }

    function parseMarkdownFile(file: VFile): Root {
        return unified().use(remarkParse).parse(file);
    }
}

function deleteInjectedContent(root: Root, file: VFile): Root {
    const directiveNodes = collectInjectionNodes(root);
    const pairs = findInjectionPairs(directiveNodes, file);

    interface BaseNode {
        type: string;
    }

    const starts = new Set<BaseNode>(
        pairs
            .map((p) => p.end && p.start)
            .filter(isDefined)
            .map((d) => d.node)
    );
    const ends = new Set<BaseNode>(
        pairs
            .map((p) => p.start && p.end)
            .filter(isDefined)
            .map((d) => d.node)
    );
    const toDelete = new Set<BaseNode>(
        pairs
            .map((p) => p.end)
            .filter(isDefined)
            .map((d) => d.node)
    );

    let deleteDepth = 0;

    visit(
        root,
        () => true,
        (node: BaseNode) => {
            if (deleteDepth) {
                toDelete.add(node);
            }
            if (starts.has(node)) {
                ++deleteDepth;
            }
            if (ends.has(node)) {
                --deleteDepth;
                assert(deleteDepth >= 0);
            }
        }
    );

    remove(root, (node: BaseNode) => toDelete.has(node));

    return root;
}

interface DirectivePair {
    start?: DirectiveNode | undefined;
    end?: DirectiveNode | undefined;
}

interface Directive {
    type: 'start' | 'end';
    file: string;
}

interface DirectiveNode extends Partial<Directive> {
    node: HTML;
    parent: Parent;
}

function findInjectionPairs(nodes: DirectiveNode[], vfile: VFile): DirectivePair[] {
    function validate(n: DirectiveNode): n is Required<DirectiveNode> {
        if (!n.type) {
            vfile.message('Unable to parse @@inject directive.', n.node.position);
            return false;
        }
        if (n.type === 'start' && !n.file) {
            vfile.message('Missing injection filename.', n.node.position);
            return false;
        }
        return true;
    }

    const dnp = nodes.filter(validate);

    const pairs: DirectivePair[] = [];

    let last: DirectiveNode | undefined = undefined;
    for (const n of dnp.reverse()) {
        if (n.type === 'start') {
            if (last?.file && last?.file !== n.file) {
                vfile.message(`Unmatched @@inject-end "${last.file || ''}"`, last.node.position);
                pairs.push({ end: last });
                last = undefined;
            }
            pairs.push({ start: n, end: last });
            last = undefined;
            continue;
        }
        if (last) {
            vfile.message(`Unmatched @@inject-end "${last.file || ''}"`, last.node.position);
            pairs.push({ end: last });
        }
        last = n;
    }

    return pairs.reverse();
}

function parseDirectiveNode(node: HTML): Directive | undefined {
    return parseDirective(node.value);
}

function parseDirective(html: string): Directive | undefined {
    const m = html.match(injectDirectiveRegExp);
    if (!m || !m.groups) return undefined;

    const d: Directive = {
        type: m.groups['type'] === '-end' ? 'end' : 'start',
        file: m.groups['file'].trim(),
    };
    return d;
}

function collectInjectionNodes(root: Root): DirectiveNode[] {
    const nodes: DirectiveNode[] = [];
    visit(root, isInjectNode, (node, _index, parent) => {
        parent && nodes.push({ node, parent });
    });

    const dNodes = nodes.map((node) => ({ ...node, ...(parseDirectiveNode(node.node) || {}) }));
    return dNodes;
}

interface VFileData {
    encoding?: BufferEncoding;
}

async function readFile(fs: FileSystemAdapter, path: PathLike, encoding: BufferEncoding = 'utf8'): Promise<VFile> {
    const value = await fs.readFile(path, encoding);
    return new VFile({ path, value, data: { encoding } });
}

function detectLineEnding(content: string): string {
    const pos = content.indexOf('\n');
    return content[pos - 1] === '\r' ? '\r\n' : '\n';
}

function isHtmlNode(n: Node | unknown): n is HTML {
    return is(n, 'html');
}

function isInjectNode(n: Node | unknown): n is HTML {
    if (!isHtmlNode(n)) {
        return false;
    }
    return directiveRegExp.test(n.value);
}

function extractContent(file: VFile, defaultEncoding?: BufferEncoding): string {
    return toString(file.value, getEncoding(file, defaultEncoding));
}

function getEncoding(file: VFile, defaultEncoding: BufferEncoding = 'utf8'): BufferEncoding {
    const data: VFileData = file.data;
    return data.encoding || defaultEncoding;
}

function toString(content: string | Buffer, encoding: BufferEncoding): string {
    return typeof content === 'string' ? content : content.toString(encoding);
}

function fixContentLineEndings(content: string, lineEnding: string, fixEofNewLine: boolean): string {
    const fixed = content.replace(/\r?\n/g, lineEnding);
    return fixEofNewLine && !hasEofNewLine(fixed) ? fixed + lineEnding : fixed;
}

function hasEofNewLine(content: string): boolean {
    return content[content.length - 1] === '\n';
}

function isDefined<T>(v: T | undefined | null): v is T {
    return v !== undefined && v !== null;
}

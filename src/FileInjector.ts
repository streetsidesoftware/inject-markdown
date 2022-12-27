import { FileSystemAdapter, PathLike, BufferEncoding } from './FileSystemAdapter.js';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { VFile } from 'vfile';
import { reporter } from 'vfile-reporter';
import type { Root, Content, HTML } from 'mdast';
import {} from 'remark';
import { remove } from 'unist-util-remove';
import { visit } from 'unist-util-visit';
import { is } from 'unist-util-is';
import * as path from 'node:path';
import assert from 'assert';

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
        const fileValue = file.value;
        const content = extractContent(file, encoding);
        const lineEnding = detectLineEnding(content);
        const result = await processFileContent(this.fs, file);
        if (result.value === fileValue) {
            this.options.outputDir && (await this.writeResult(result));
            return false;
        }
        console.log(reporter(result));
        const resultAsString = extractContent(result, encoding);
        const resultContent = fixContentLineEndings(resultAsString, lineEnding, hasEofNewLine(content));
        if (content === resultContent) {
            this.options.outputDir && (await this.writeResult(result));
            return false;
        }
        await this.writeResult(result);
        return true;
    }

    private async writeResult(file: VFile): Promise<void> {
        const content = extractContent(file);
        const filePath = this.determineTargetPath(file);
        const dir = path.dirname(filePath);
        await this.fs.mkdir(dir, { recursive: true });
        return this.fs.writeFile(filePath, content, getEncoding(file));
    }

    private determineTargetPath(file: VFile): string {
        const outDir = this.options.outputDir;
        if (!outDir) return file.path;

        const cwd = path.resolve(this.options.cwd || file.cwd);
        const srcPath = path.resolve(cwd, file.path);
        const relPath = path.relative(cwd, srcPath);

        return path.join(path.resolve(outDir), relPath);
    }
}

async function processFileContent(fs: FileSystemAdapter, file: VFile): Promise<VFile> {
    if (!extractContent(file).includes(directivePrefix)) {
        return file;
    }
    const result = await unified().use(remarkParse).use(processInjections, fs).use(remarkStringify).process(file);
    return result;
}

function processInjections(_fs: FileSystemAdapter) {
    return (root: Root, file: VFile): Root => {
        root = deleteInjectedContent(root, file);
        return root;
    };
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
            if (starts.has(node)) {
                ++deleteDepth;
            }
            if (deleteDepth) {
                toDelete.add(node);
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

interface DirectiveNode {
    node: HTML;
    index: number | null;
    parent: Node | null;
}

interface DirectivePair {
    start?: DirectiveNode | undefined;
    end?: DirectiveNode | undefined;
}

interface Directive {
    type: 'start' | 'end';
    file: string;
}

interface NodeAndDirective {
    directive: Directive | undefined;
    node: DirectiveNode;
}

function findInjectionPairs(nodes: DirectiveNode[], vfile: VFile): DirectivePair[] {
    function validate(n: NodeAndDirective): n is Required<NodeAndDirective> {
        if (!n.directive) {
            vfile.message('Unable to parse @@inject directive.', n.node?.node.position);
            return false;
        }
        if (n.directive.type === 'start' && !n.directive.file) {
            vfile.message('Missing injection filename.', n.node?.node.position);
            return false;
        }
        return true;
    }

    const dnp = nodes.map((node) => ({ node, directive: parseDirective(node.node.value) })).filter(validate);

    const pairs: DirectivePair[] = [];

    let last: NodeAndDirective | undefined = undefined;
    for (const n of dnp.reverse()) {
        if (n.directive?.type === 'start') {
            if (last?.directive?.file && last?.directive?.file !== n.directive.file) {
                vfile.message(`Unmatched @@inject-end "${last.directive?.file || ''}"`, last.node.node.position);
                pairs.push({ end: last.node });
                last = undefined;
            }
            pairs.push({ start: n.node, end: last?.node });
            last = undefined;
            continue;
        }
        if (last) {
            vfile.message(`Unmatched @@inject-end "${last.directive?.file || ''}"`, last.node.node.position);
            pairs.push({ end: last.node });
        }
        last = n;
    }

    return pairs.reverse();
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
    visit(root, isInjectNode, (node, index, parent) => {
        nodes.push({ node, index, parent });
    });

    return nodes;
}

interface VFileData {
    encoding?: BufferEncoding;
}

async function readFile(fs: FileSystemAdapter, path: PathLike, encoding: BufferEncoding): Promise<VFile> {
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

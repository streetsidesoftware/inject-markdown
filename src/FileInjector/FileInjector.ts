import assert from 'assert';
import chalk, { supportsColor } from 'chalk';
import type { Code, Content, Heading, HTML, Parent, Root } from 'mdast';
import * as path from 'node:path';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { is } from 'unist-util-is';
import { remove } from 'unist-util-remove';
import { visit } from 'unist-util-visit';
import { fileURLToPath } from 'url';
import { Data as VFileData, VFile } from 'vfile';
import { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { fileType } from '../util/fileType.mjs';
import { parseHash } from '../util/hash.js';
import { dirToUrl, parseRelativeUrl, pathToUrl, relativePath, RelURL } from '../util/url_helper.js';
import { VFileEx } from './VFileEx';

type Node = Root | Content;

const injectDirectiveRegExp = /^[ \t]*<!---?\s*@@inject(?<type>|-start|-end|-code):\s*(?<file>.*?)-?-->$/;

const directiveRegExp = /^[ \t]*<!---?\s*@@inject(\b|-)/;

const directivePrefix = '@@inject';
const directiveStart = directivePrefix + ':';
const directiveStartVerbose = directivePrefix + '-start:';
const directiveStartCode = directivePrefix + '-code:';
const directiveEnd = directivePrefix + '-end:';

const outputOptions = {
    bullet: '-',
    emphasis: '_',
    fence: '`',
    fences: true,
    incrementListMarker: false,
    strong: '*',
} as const;

export interface FileData extends VFileData {
    encoding: BufferEncoding;
    fileUrl: URL;
    cwdUrl?: URL;
    hasInjections?: boolean;
}

export interface Logger {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    writeStdout(text: string): void;
    writeStderr(text: string): void;
}

export interface FileInjectorOptions {
    /** optional output directory */
    outputDir?: string | undefined;
    /** Current working directory */
    cwd?: PathLike | undefined;
    /** Only clean the file, do not inject */
    clean?: boolean;

    /**
     * Only show errors.
     */
    silent?: boolean;

    /**
     * Use color
     * `true` - force color
     * `false` - no color
     * `undefined` - let chalk decide.
     */
    color?: boolean | undefined;

    /**
     * Verbose Level
     * `0` || `false` = none
     * `1` || `true` = light
     */
    verbose?: number | boolean;

    /**
     * If an error occurs, the file is skipped and not written.
     * This options will write the file.
     * `false` - the file will skipped
     * `true` - the file will be written
     * @default false
     */
    writeOnError?: boolean;

    /**
     * Stop processing if there is an error in any file.
     * `true` - stop processing on any error.
     * `false` - keep going even if errors occur.
     * @default true
     */
    stopOnErrors?: boolean;

    logger?: Logger;
}

export class FileInjector {
    private cwd: URL;
    constructor(readonly fs: FileSystemAdapter, readonly options: FileInjectorOptions) {
        this.cwd = dirToUrl(options?.cwd || '');
    }

    /**
     * Process all injections for a file.
     * @param filePath - path to file to process
     * @param encoding - file encoding
     * @returns true if changed, otherwise false.
     */
    async processFile(filePath: PathLike, encoding: BufferEncoding = 'utf8'): Promise<ProcessFileResult> {
        const fileUrl = pathToUrl(filePath, this.cwd);
        const file = await readFile(this.fs, fileUrl, encoding);
        const logger: Logger = {
            log: console.log.bind(console),
            error: console.error.bind(console),
            warn: console.error.bind(console),
            writeStdout: process.stdout.write.bind(process.stdout),
            writeStderr: process.stderr.write.bind(process.stderr),
        };
        file.data.cwdUrl = this.cwd;
        return await processFileInjections(file, this.fs, {
            ...this.options,
            cwd: this.cwd,
            fileUrl,
            logger: this.options.logger || logger,
            verbose: (!this.options.silent && this.options.verbose) || false,
            outputDir: this.options.outputDir ? dirToUrl(this.options.outputDir) : undefined,
            writeOnError: this.options.writeOnError ?? false,
            stopOnErrors: this.options.stopOnErrors ?? true,
        });
    }
}

interface ProcessFileInjections extends Omit<FileInjectorOptions, 'cwd' | 'outputDir'> {
    cwd: URL;
    fileUrl: URL;
    logger: Logger;
    outputDir: URL | undefined;
    writeOnError: boolean;
    stopOnErrors: boolean;
}

export interface ProcessFileResult {
    /** Were any injections found? */
    injectionsFound: boolean;
    /** The resulting file */
    file: VFileEx;
    /** had injection errors? */
    hasErrors: boolean;
    /** file was written */
    written: boolean;
    /**
     * The content was updated.
     */
    hasChanged: boolean;
    /**
     * File was skipped due to errors.
     */
    skipped: boolean;
}

async function processFileInjections(
    vFile: VFileEx | VFile,
    fs: FileSystemAdapter,
    options: ProcessFileInjections
): Promise<ProcessFileResult> {
    assert(isVFileEx(vFile));
    const file = vFile;
    const fileUrl = file.data.fileUrl;
    setColor();
    const logger = options.logger;
    // console.log('File: %s\nOptions: %o', file.path, options);
    const yellow = chalk.yellow;
    const green = chalk.green;
    const gray = chalk.gray;
    const stderr = options.silent ? { write: () => undefined } : { write: (s: string) => logger.writeStderr(s) };
    stderr.write(yellow(relativePathNormalized(file.data.fileUrl, options.cwd)) + ' ...');
    const r = await __processFile();
    stderr.write((options.verbose ? '\n  ' : ' ') + green('done.') + '\n');
    return r;

    function setColor() {
        if (options.color === false) {
            chalk.level = 0;
        }
        if (options.color) {
            chalk.level = chalk.level || (supportsColor && supportsColor.level) || 2;
        }
    }

    async function __processFile(): Promise<ProcessFileResult> {
        const fileValue = file.value;
        const content = extractContent(file);
        const lineEnding = detectLineEnding(content);
        const processFileResult: ProcessFileResult = {
            file,
            injectionsFound: false,
            hasErrors: false,
            written: false,
            hasChanged: false,
            skipped: false,
        };
        const result = await processFileContent();
        const injectionsFound = result.data.hasInjections || false;
        processFileResult.injectionsFound = injectionsFound;
        if (!injectionsFound && result.value === fileValue) {
            if (options.outputDir) {
                await writeResult(result);
                processFileResult.written = true;
            }
            return processFileResult;
        }
        const hasErrors = result.messages.length > 0;
        const resultAsString = extractContent(result);
        const resultContent = fixContentLineEndings(resultAsString, lineEnding, hasEofNewLine(content));
        const hasChanged = content !== resultContent;
        processFileResult.hasChanged = hasChanged;
        processFileResult.hasErrors = hasErrors;
        const stale = hasChanged || !!options.outputDir;
        if (stale) {
            if (!hasErrors || options.writeOnError) {
                await writeResult(result);
                processFileResult.written = true;
            } else {
                processFileResult.skipped = true;
            }
        }
        // console.log('Result: %o', { hasErrors, hasChanged, stale, injectionsFound });
        return processFileResult;
    }

    async function writeResult(file: VFileEx): Promise<void> {
        const content = extractContent(file);
        const filePath = fileURLToPath(determineTargetPath(file));
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        return fs.writeFile(filePath, content, getEncoding(file));
    }

    function determineTargetPath(file: VFileEx): URL {
        const outDir = options.outputDir;
        const { fileUrl } = file.data;
        if (!outDir) return fileUrl;

        const cwd = options.cwd;
        const relPath = relativePath(cwd, fileUrl);
        return relPath.toUrl(outDir);
    }

    async function processFileContent(): Promise<VFileEx> {
        if (!extractContent(file).includes(directivePrefix)) {
            file.data.hasInjections = false;
            return file;
        }
        const result = await unified()
            .use(remarkParse)
            .use(processHasInjections)
            .use(processInjections)
            .use(remarkStringify, outputOptions)
            .process(file);
        assert(isVFileEx(result));
        return result;
    }

    function processHasInjections() {
        return (root: Root, file: VFile): Root => {
            assert(isVFileEx(file));
            const nodes = collectInjectionNodes(root);
            file.data.hasInjections = nodes.length > 0;
            return root;
        };
    }

    function processInjections() {
        return async (root: Root, file: VFile): Promise<Root> => {
            assert(isVFileEx(file));
            root = deleteInjectedContent(root, file);
            if (options.clean) return root;
            root = await injectFiles(root);
            return root;
        };
    }

    async function injectFiles(root: Root): Promise<Root> {
        const directiveNodes = collectInjectionNodesAndParse(root);

        for (const node of directiveNodes) {
            if (!node.file) continue;
            await injectFile(node);
        }

        return root;
    }

    async function injectFile(directive: DirectiveNode): Promise<void> {
        switch (directive.type) {
            case 'start':
                return injectMarkdownFile(directive);
            case 'code':
                return injectCodeFile(directive);
        }
    }

    async function injectMarkdownFile(directive: DirectiveNode): Promise<void> {
        if (!directive.file || directive.type !== 'start') return;
        const dFile = directive.file;
        const directiveFileUrl = dFile.toUrl(fileUrl);
        options.verbose && stderr.write(`\n  ${gray(dFile.href)}`);
        const root = await readAndParseMarkdownFile(directiveFileUrl);
        return injectContent(directive, root);
    }

    async function injectCodeFile(directive: DirectiveNode): Promise<void> {
        if (!directive.file || directive.type !== 'code') return;
        const dFile = directive.file;
        const directiveFileUrl = dFile.toUrl(fileUrl);
        options.verbose && stderr.write(`\n  ${gray(dFile.href)}`);
        const root = await readAndParseCodeFile(directiveFileUrl);
        return injectContent(directive, root);
    }

    async function injectContent(directive: DirectiveNode, root: Root): Promise<void> {
        if (!directive.file) return;
        const href = normalizeHref(directive.file.href);
        const parent = directive.parent;
        const index = parent.children.indexOf(directive.node);
        assert(index >= 0);
        const startDirective = directive.node.value.includes(directiveStartVerbose)
            ? directiveStartVerbose
            : directive.node.value.includes(directiveStartCode)
            ? directiveStartCode
            : directiveStart;
        const start: HTML = {
            type: 'html',
            value: `<!--- ${startDirective} ${href} --->`,
        };
        const end: HTML = {
            type: 'html',
            value: `<!--- ${directiveEnd} ${href} --->`,
        };
        parent.children.splice(index, 1, start, ...root.children, end);
    }

    async function readAndParseCodeFile(fileName: URL): Promise<Root> {
        const info = parseHash(fileName);
        const lang = info.lang;
        const lines = info.lines;
        try {
            const vFile = await resolveAndReadFile(fileName);
            const content = extractLines(extractContent(vFile), lines);
            const code: Code = {
                type: 'code',
                lang: lang || fileType(fileName.pathname),
                value: content.trim(),
            };
            return {
                type: 'root',
                children: [code],
            };
        } catch (e) {
            const err = toError(e);
            file.message(err.message);
            return errorToComment(err);
        }
    }

    async function readAndParseMarkdownFile(fileUrl: URL): Promise<Root> {
        const info = parseHash(fileUrl);
        const lines = info.lines;
        const heading = lines ? '' : info.heading || '';
        try {
            const vFile = await resolveAndReadFile(fileUrl);
            if (lines) {
                vFile.value = extractLines(extractContent(vFile), lines);
            }
            const root = parseMarkdownFile(vFile);
            sanitizeImport(root);
            return extractHeader(root, heading);
        } catch (e) {
            const err = toError(e);
            file.message(err.message);
            return errorToComment(err);
        }
    }

    async function resolveAndReadFile(file: URL): Promise<VFileEx> {
        try {
            return await readFile(fs, file);
        } catch (e) {
            // console.log('resolveAndReadFile: (%s) %o', file.href, e);
            throw new Error(`Failed to read "${relativePathNormalized(file)}"`);
        }
    }

    function parseMarkdownFile(file: VFileEx): Root {
        return unified().use(remarkParse).parse(file);
    }

    function relativePathNormalized(path: URL, relDir?: URL): string {
        return relativePath(relDir || file.data.cwdUrl || options.cwd, path).toString();
    }
}

function sanitizeImport(root: Root): Root {
    remove(root, (n: Node) => isHtmlNode(n) && directiveRegExp.test(n.value));
    return root;
}

function extractHeader(root: Root, header: string | undefined): Root {
    if (!header) return root;

    function normalizeHeader(h: string): string {
        return h.toLowerCase().replace(/[-_\s#`*]/g, '');
    }

    const searchFor = normalizeHeader(header);
    const children = root.children;
    const foundIdx = children.findIndex(
        (n: Content) => isHeadingNode(n) && normalizeHeader(headingString(n)) === searchFor
    );
    const found = root.children[foundIdx];
    if (!found || !isHeadingNode(found)) {
        return {
            type: 'root',
            children: [
                {
                    type: 'html',
                    value: `<!--- header: "${header}" not found.  --->`,
                },
            ],
        };
    }

    const nodes: Content[] = [found];

    const depth = found.depth;

    for (let i = foundIdx + 1; i < children.length; ++i) {
        const n = children[i];
        if (isHeadingNode(n) && n.depth <= depth) {
            break;
        }
        nodes.push(n);
    }

    return { type: 'root', children: nodes };
}

function headingString(n: Heading): string {
    const md = unified()
        .use(remarkStringify)
        .stringify({ type: 'root', children: [n] });
    return md;
}

function deleteInjectedContent(root: Root, file: VFileEx): Root {
    const directiveNodes = collectInjectionNodesAndParse(root);
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

type DirectiveType = 'start' | 'end' | 'code';
interface Directive {
    type: DirectiveType;
    file: RelURL;
}

interface DirectiveNode extends Partial<Directive> {
    node: HTML;
    parent: Parent;
}

const startTypes: Record<DirectiveType, boolean> = {
    start: true,
    code: true,
    end: false,
} as const;

function findInjectionPairs(nodes: DirectiveNode[], vfile: VFileEx): DirectivePair[] {
    function validate(n: DirectiveNode): n is Required<DirectiveNode> {
        if (!n.type) {
            vfile.message('Unable to parse @@inject directive.', n.node.position);
            return false;
        }
        if (startTypes[n.type] && !n.file) {
            vfile.message('Missing injection filename.', n.node.position);
            return false;
        }
        return true;
    }

    const dnp = nodes.filter(validate);

    const pairs: DirectivePair[] = [];
    let last: DirectiveNode | undefined = undefined;
    for (const n of dnp.reverse()) {
        if (startTypes[n.type]) {
            if (last?.file && !refersToTheSameFile(last.file, n.file)) {
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

    const file = parseRelativeUrl(m.groups['file']);
    const params = parseHash(file);
    const isEnd = m.groups['type'] === '-end';
    const isCode =
        (!isEnd && !file.pathname.toLowerCase().endsWith('.md')) || m.groups['type'] === '-code' || !!params.lang;

    const d: Directive = {
        type: isEnd ? 'end' : isCode ? 'code' : 'start',
        file,
    };
    return d;
}

function collectInjectionNodes(root: Root): DirectiveNode[] {
    const nodes: DirectiveNode[] = [];
    visit(root, isInjectNode, (node, _index, parent) => {
        parent && nodes.push({ node, parent });
    });
    return nodes;
}

function collectInjectionNodesAndParse(root: Root): DirectiveNode[] {
    const nodes: DirectiveNode[] = collectInjectionNodes(root);

    const dNodes = nodes.map((node) => ({ ...node, ...(parseDirectiveNode(node.node) || {}) }));
    return dNodes;
}

async function readFile(fs: FileSystemAdapter, path: URL, encoding: BufferEncoding = 'utf8'): Promise<VFileEx> {
    const value = await fs.readFile(path, encoding);
    const data: FileData = {
        encoding,
        fileUrl: path,
    };
    // use path.pathname because Vfile blows up if it isn't a file: url.
    const file = new VFile({ path: path.pathname, value, data });
    assert(isVFileEx(file));
    return file;
}

function detectLineEnding(content: string): string {
    const pos = content.indexOf('\n');
    return content[pos - 1] === '\r' ? '\r\n' : '\n';
}

function isHtmlNode(n: Node | unknown): n is HTML {
    return is(n, 'html');
}

function isHeadingNode(n: Node | unknown): n is Heading {
    return is(n, 'heading');
}

function isInjectNode(n: Node | unknown): n is HTML {
    if (!isHtmlNode(n)) {
        return false;
    }
    return directiveRegExp.test(n.value);
}

function extractContent(file: VFileEx, defaultEncoding?: BufferEncoding): string {
    return toString(file.value, getEncoding(file, defaultEncoding));
}

function getEncoding(file: VFileEx, defaultEncoding: BufferEncoding = 'utf8'): BufferEncoding {
    const data: FileData = file.data;
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

export function normalizePath(p: string): string;
export function normalizePath(p: URL): URL;
export function normalizePath(p: PathLike): PathLike;
export function normalizePath(p: PathLike): PathLike {
    if (typeof p !== 'string') return p;
    return path.sep === '\\' ? p.replace(/\\/g, '/') : p;
}

function toError(e: unknown): Error {
    if (e && typeof e === 'object') return e as Error;
    if (typeof e === 'string') return new Error(e);
    return new Error('Unknown');
}

function errorToComment(err: Error): Root {
    const msg = (err.message || err.toString()).split('\n').join('\n  ');
    return unified().use(remarkParse).parse(`\
<!---
  ${msg}
--->`);
}

function isVFileEx(file: VFile | VFileEx): file is VFileEx {
    return !!file.data.fileUrl;
}

function normalizeHref(href: string): string {
    return href.replace(/%20/g, ' ');
}

function extractLines(content: string, lines: [number, number] | undefined): string {
    if (!lines) return content;

    const cLines = content.split('\n');
    return cLines.slice(lines[0] - 1, lines[1]).join('\n');
}

function refersToTheSameFile(a: RelURL | URL, b: RelURL | URL): boolean {
    return a.pathname === b.pathname && a.search === b.search;
}

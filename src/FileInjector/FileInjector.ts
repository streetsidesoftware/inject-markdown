import * as path from 'node:path';

import assert from 'assert';
import chalk, { supportsColor } from 'chalk';
import type { Html, Parent, Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify';
import { unified } from 'unified';
import { remove } from 'unist-util-remove';
import { visit } from 'unist-util-visit';
import { fileURLToPath, pathToFileURL } from 'url';
import type { VFile } from 'vfile';

import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { delimiterForExtension, parseDelimitedText } from '../util/csv.js';
import { fileType } from '../util/fileType.mjs';
import { type InjectInfo, parseHash } from '../util/hash.js';
import { isDefined } from '../util/isDefined.js';
import { substituteInString, substituteInTree } from '../util/placeholders.js';
import { dirToUrl, pathToUrl, relativePath, type RelURL } from '../util/url_helper.js';
import { detectMarkdownStyle } from './detectStyle.js';
import { type Directive, directiveRegExp, type DirectiveType, parseDirective } from './Directive.js';
import { jsonToRows, mapJsonStrings } from './jsonTable.js';
import { applyQuote, errorToComment, extractHeader, isHtmlNode, sanitizeImport, toCode, toRoot } from './Markdown.js';
import { applyPatches, indentContinuationLines, lineIndent, type Patch, stringifyFragment } from './patchContent.js';
import {
    applySubstitution,
    type ApplySubstitutionDeps,
    resolveRunWideValueSources,
    type RunWideValueSources,
} from './placeholderValues.js';
import { applyRowWindow, resolveHeaderRows, resolveRowWindow, type RowWindow } from './rowWindow.js';
import { type CellValue, type HeaderRowsOption, isJsonCell, rowsToHtmlTable, rowsToTable } from './Table.js';
import { toError, toString } from './utils.js';
import { type FileData, isVFileEx, VFileEx } from './VFileEx.js';

const directivePrefix = '@@inject';
const directiveStart = directivePrefix + ':';
const directiveStartVerbose = directivePrefix + '-start:';
const directiveStartCode = directivePrefix + '-code:';
const directiveStartTable = directivePrefix + '-table:';
const directiveEnd = directivePrefix + '-end:';

/** Fallback style for constructs `detectMarkdownStyle` finds no evidence for. */
const defaultOutputOptions: StringifyOptions = {
    bullet: '-',
    emphasis: '_',
    fence: '`',
    fences: true,
    incrementListMarker: false,
    rule: '-',
    strong: '*',
};

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
     * Only rewrite the text spans covered by `@@inject` directives (start
     * marker through end marker, inclusive); everything else in the file is
     * left byte-for-byte identical to the source, instead of re-stringifying
     * the whole document.
     *
     * The CLI defaults this to `true` (`--no-inject-only` to opt out); left
     * unset here, this library defaults to `false`.
     */
    injectOnly?: boolean;

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

    /**
     * Dry Run mode, do not write files.
     */
    dryRun?: boolean;

    /**
     * Additional directories, outside the injection root (`cwd`), that a local
     * directive-file reference is allowed to resolve into.
     */
    allowOutsideRoot?: string[] | undefined;

    /**
     * Run-wide placeholder values (`--value name=val`), last-wins on a repeated name.
     * See docs/ADRs/template-variables/0003-cli-and-env-value-sources.md.
     */
    value?: Record<string, string> | undefined;

    /**
     * Run-wide placeholder values files (`--values-file [prefix:]path`), repeatable.
     * Resolved relative to `cwd`, not subject to the injection-root boundary.
     * See docs/ADRs/template-variables/0003-cli-and-env-value-sources.md, 0007-values-file-prefixing.md.
     */
    valuesFile?: string[] | undefined;

    /**
     * Environment variable names a directive may reference via `{@ env.NAME @}`.
     * See docs/ADRs/template-variables/0003-cli-and-env-value-sources.md.
     */
    allowEnv?: string[] | undefined;

    /**
     * Run-wide placeholder aliases (`--value-alias new=target`), last-wins on a repeated name.
     * See docs/ADRs/template-variables/0010-value-alias.md.
     */
    valueAlias?: Record<string, string> | undefined;

    /**
     * Treat an unresolved placeholder as a directive error instead of a warning.
     * See docs/ADRs/template-variables/0005-unresolved-placeholders-and-strict-mode.md.
     */
    strictVars?: boolean | undefined;
}

export class FileInjector {
    private cwd: URL;
    private runWideValuesPromise: Promise<RunWideValueSources> | undefined;
    constructor(
        readonly fs: FileSystemAdapter,
        readonly options: FileInjectorOptions,
    ) {
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
            runWideValues: await this.resolveRunWideValues(),
        });
    }

    /** Run-wide placeholder value sources: resolved once and cached across every file in this run. */
    private async resolveRunWideValues(): Promise<RunWideValueSources> {
        this.runWideValuesPromise ??= resolveRunWideValueSources(this.fs, this.options, this.cwd);
        return this.runWideValuesPromise;
    }
}

interface ProcessFileInjections extends Omit<FileInjectorOptions, 'cwd' | 'outputDir'> {
    cwd: URL;
    fileUrl: URL;
    logger: Logger;
    outputDir: URL | undefined;
    writeOnError: boolean;
    stopOnErrors: boolean;
    /** Run-wide placeholder value sources: `--value`/`--values-file`/`--value-alias`/`--allow-env`. */
    runWideValues: RunWideValueSources;
}

export interface ProcessFileResult {
    /** Were any injections found? */
    injectionsFound: boolean;
    /** The resulting file */
    file: VFileEx;
    /** had injection errors? */
    hasErrors: boolean;
    /** had injection warnings? */
    hasMessages: boolean;
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
    options: ProcessFileInjections,
): Promise<ProcessFileResult> {
    assert(isVFileEx(vFile));
    const file = vFile;
    const fileUrl = file.data.fileUrl;
    const content = extractContent(file);
    const lineEnding = detectLineEnding(content);
    let injectionRootsPromise: Promise<InjectionRoots> | undefined;
    const substitutionDeps: ApplySubstitutionDeps = {
        fs,
        fileUrl,
        strictVars: options.strictVars,
        runWide: options.runWideValues,
        resolveWithinInjectionRoot,
        reportError: (message, position) => file.error(message, position),
        reportMessage: (message, position) => file.message(message, position),
    };
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
        const processFileResult: ProcessFileResult = {
            file,
            injectionsFound: false,
            hasErrors: false,
            hasMessages: false,
            written: false,
            hasChanged: false,
            skipped: false,
        };
        const result = await processFileContent();
        const injectionsFound = result.data.hasInjections || false;
        processFileResult.injectionsFound = injectionsFound;
        if (!injectionsFound && result.value === fileValue) {
            if (options.outputDir) {
                if (!options.dryRun) {
                    await writeResult(result);
                    processFileResult.written = true;
                } else {
                    processFileResult.skipped = true;
                }
            }
            return processFileResult;
        }
        const hasErrors = result.messages.filter((m) => m.fatal).length > 0;
        const hasMessages = result.messages.filter((m) => !m.fatal).length > 0;
        const resultContent =
            options.injectOnly && result.data.injectOnlyPatches
                ? applyPatches(content, result.data.injectOnlyPatches)
                : fixContentLineEndings(extractContent(result), lineEnding, hasEofNewLine(content));
        if (options.injectOnly && result.data.injectOnlyPatches) {
            // Ensure the bytes written match `resultContent` exactly, not the
            // whole-document re-stringify that also ran (and is discarded here).
            result.value = resultContent;
        }
        const hasChanged = content !== resultContent;
        processFileResult.hasChanged = hasChanged;
        processFileResult.hasErrors = hasErrors;
        processFileResult.hasMessages = hasMessages;
        const stale = hasChanged || !!options.outputDir;
        if (stale) {
            if ((!hasErrors || options.writeOnError) && !options.dryRun) {
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
        // remarkStringify reads this object lazily at compile time, so
        // processHasInjections can still mutate it after `.use()`.
        const outputOptions: StringifyOptions = { ...defaultOutputOptions };
        const result = await initParser(toInitOptions(file))
            .use(processHasInjections, outputOptions)
            .use(processInjections, outputOptions)
            .use(remarkStringify, outputOptions)
            .process(file);
        assert(isVFileEx(result));
        return result;
    }

    function processHasInjections(outputOptions: StringifyOptions) {
        return (root: Root, file: VFile): Root => {
            assert(isVFileEx(file));
            const nodes = collectInjectionNodes(root);
            file.data.hasInjections = nodes.length > 0;
            Object.assign(outputOptions, detectMarkdownStyle(root, extractContent(file)));
            return root;
        };
    }

    function processInjections(outputOptions: StringifyOptions) {
        return async (root: Root, file: VFile): Promise<Root> => {
            assert(isVFileEx(file));
            const endOffsets = options.injectOnly ? new Map<Html, number>() : undefined;
            root = deleteInjectedContent(root, file, endOffsets);
            if (options.clean) {
                if (endOffsets) {
                    file.data.injectOnlyPatches = [...endOffsets].map(([startNode, endOffset]) => ({
                        start: startNode.position?.end.offset ?? endOffset,
                        end: endOffset,
                        text: '',
                    }));
                }
                return root;
            }
            const ctx: InjectOnlyCtx | undefined = endOffsets
                ? { outputOptions, endOffsets, lineEnding, patches: [] }
                : undefined;
            root = await injectFiles(root, ctx);
            if (ctx) file.data.injectOnlyPatches = ctx.patches;
            return root;
        };
    }

    async function injectFiles(root: Root, ctx: InjectOnlyCtx | undefined): Promise<Root> {
        const directiveNodes = collectInjectionNodesAndParse(root);

        for (const node of directiveNodes) {
            if (!isDirectiveNode(node) || !node.directive.file?.href) continue;
            await injectFile(node, ctx);
        }

        return root;
    }

    async function injectFile(dn: DirectiveNode, ctx: InjectOnlyCtx | undefined): Promise<void> {
        switch (dn.directive.type) {
            case 'start':
                return injectMarkdownFile(dn, ctx);
            case 'code':
                return injectCodeFile(dn, ctx);
            case 'table':
                return injectTableFile(dn, ctx);
        }
    }

    async function injectMarkdownFile(dn: DirectiveNode, ctx: InjectOnlyCtx | undefined): Promise<void> {
        const directive = dn.directive;
        if (!directive.file || directive.type !== 'start') return;
        const dFile = directive.file;
        const directiveFileUrl = dFile.toUrl(fileUrl);
        if (options.verbose) stderr.write(`\n  ${gray(dFile.href)}`);
        const root = await readAndParseMarkdownFile(directiveFileUrl, dn);
        return injectContent(dn, root, ctx);
    }

    async function injectCodeFile(dn: DirectiveNode, ctx: InjectOnlyCtx | undefined): Promise<void> {
        const directive = dn.directive;
        if (!directive.file || directive.type !== 'code') return;
        const dFile = directive.file;
        const directiveFileUrl = dFile.toUrl(fileUrl);
        if (options.verbose) stderr.write(`\n  ${gray(dFile.href)}`);
        const root = await readAndParseCodeFile(directiveFileUrl, dn);
        return injectContent(dn, root, ctx);
    }

    async function injectTableFile(dn: DirectiveNode, ctx: InjectOnlyCtx | undefined): Promise<void> {
        const directive = dn.directive;
        if (!directive.file || directive.type !== 'table') return;
        const dFile = directive.file;
        const directiveFileUrl = dFile.toUrl(fileUrl);
        if (options.verbose) stderr.write(`\n  ${gray(dFile.href)}`);
        const root = await readAndParseTableFile(directiveFileUrl, dn);
        return injectContent(dn, root, ctx);
    }

    async function injectContent(
        dn: DirectiveNode,
        parseResult: ParseResult,
        ctx: InjectOnlyCtx | undefined,
    ): Promise<void> {
        const directive = dn.directive;
        if (!directive.file) return;
        const { info } = parseResult;
        const root = applyQuote(parseResult.root, info.quote ?? false);
        const href = normalizeHref(directive.file.href);
        const parent = dn.parent;
        const index = parent.children.indexOf(dn.node);
        assert(index >= 0);
        const startDirective = dn.node.value.includes(directiveStartVerbose)
            ? directiveStartVerbose
            : dn.node.value.includes(directiveStartCode)
              ? directiveStartCode
              : dn.node.value.includes(directiveStartTable)
                ? directiveStartTable
                : directiveStart;
        const start: Html = {
            type: 'html',
            value: `<!--- ${startDirective} ${href} --->`,
        };
        const end: Html = {
            type: 'html',
            value: `<!--- ${directiveEnd} ${href} --->`,
        };
        if (ctx) {
            const startOffset = dn.node.position?.start.offset;
            const endOffset = ctx.endOffsets.get(dn.node) ?? dn.node.position?.end.offset;
            if (startOffset !== undefined && endOffset !== undefined) {
                const fragment = stringifyFragment([start, ...root.children, end], ctx.outputOptions, ctx.lineEnding);
                // The directive may sit inside a list item or blockquote, whose
                // continuation lines share a prefix (indentation, `> `, ...).
                // That prefix falls inside the replaced span, so it has to be
                // reconstructed on every line but the first.
                const indent = lineIndent(content, startOffset);
                ctx.patches.push({
                    start: startOffset,
                    end: endOffset,
                    text: indentContinuationLines(fragment, indent),
                });
            }
        }
        parent.children.splice(index, 1, start, ...root.children, end);
    }

    async function readAndParseTableFile(fileName: URL, directive: DirectiveNode): Promise<ParseResult> {
        const info = parseHash(fileName);
        const lines = info.lines;
        try {
            const window = resolveRowWindow(info);
            const headerRows = resolveHeaderRows(info.headerRows);
            const isJson = path.extname(fileName.pathname).toLowerCase() === '.json';
            if (isJson && lines) {
                throw new Error('A line range can not be used on a JSON table; use start-row, end-row or num-rows.');
            }
            if (isJson && headerRows > 1) {
                throw new Error(
                    `header-rows=${headerRows} can not be used on a JSON table; its keys form one header row.`,
                );
            }
            const vFile = await resolveAndReadFile(fileName);
            const content = extractLines(extractContent(vFile), lines);
            // Substitution runs on the parsed cell values, per ADR-0006 point 3 — substituting into
            // the raw text first would let a value containing the delimiter add phantom columns.
            const { rows, tableOptions } = isJson
                ? jsonTableRows(content, window, headerRows)
                : delimitedTableRows(content, fileName, window, headerRows);
            await applySubstitution(info, directive.node, substitutionDeps, (resolve, onUnresolved) => {
                const sub = (text: string) => substituteInString(text, resolve, onUnresolved);
                for (const row of rows) {
                    for (let i = 0; i < row.length; ++i) {
                        const cell = row[i];
                        row[i] = isJsonCell(cell) ? { json: mapJsonStrings(cell.json, sub) as object } : sub(cell);
                    }
                }
            });
            return {
                // `#html-table` wins over `#markdown` when both are given (ADR-0010 point 2).
                root: toRoot(
                    info.htmlTable
                        ? rowsToHtmlTable(rows, tableOptions)
                        : rowsToTable(rows, { ...tableOptions, markdown: info.markdown }),
                ),
                info,
            };
        } catch (e) {
            const err = toError(e);
            file.error(err.message, directive.node.position);
            return { root: errorToComment(err), info };
        }
    }

    interface TableRows {
        rows: CellValue[][];
        tableOptions: HeaderRowsOption;
    }

    function delimitedTableRows(content: string, fileName: URL, window: RowWindow, headerRows: number): TableRows {
        const delimiter = delimiterForExtension(path.extname(fileName.pathname));
        const parsed = parseDelimitedText(content, delimiter);
        // The window counts data rows only, after the header rows (ADR-0004). A file shorter
        // than `header-rows` is all header and no data.
        const header = parsed.slice(0, headerRows);
        const rows = [...header, ...applyRowWindow(parsed.slice(headerRows), window)];
        // An empty source keeps the requested count, so it still renders an empty header row.
        return { rows, tableOptions: { headerRows: parsed.length ? header.length : headerRows } };
    }

    /** The keys are the one header row; `header-rows=0` drops it (ADR-0011 point 9). */
    function jsonTableRows(content: string, window: RowWindow, headerRows: number): TableRows {
        const [keys, ...data] = jsonToRows(content, window);
        return { rows: headerRows ? [keys, ...data] : data, tableOptions: { headerRows } };
    }

    async function readAndParseCodeFile(fileName: URL, directive: DirectiveNode): Promise<ParseResult> {
        const info = parseHash(fileName);
        const lang = info.lang;
        const lines = info.lines;
        try {
            const vFile = await resolveAndReadFile(fileName);
            let content = extractLines(extractContent(vFile), lines);
            await applySubstitution(info, directive.node, substitutionDeps, (resolve, onUnresolved) => {
                content = substituteInString(content, resolve, onUnresolved);
            });
            const code = toCode(lang || fileType(fileName.pathname), content.trim());
            return {
                root: toRoot(code),
                info,
            };
        } catch (e) {
            const err = toError(e);
            file.error(err.message, directive.node.position);
            return { root: errorToComment(err), info };
        }
    }

    async function readAndParseMarkdownFile(targetUrl: URL, directive: DirectiveNode): Promise<ParseResult> {
        const info = parseHash(targetUrl);
        const lines = info.lines;
        const heading = info.heading || '';
        try {
            const vFile = await resolveAndReadFile(targetUrl);
            if (lines) {
                vFile.value = extractLines(extractContent(vFile), lines);
            }
            const fileRoot = parseMarkdownFile(vFile);
            sanitizeImport(fileRoot);
            const markdown = extractHeader(fileRoot, heading);
            await applySubstitution(info, directive.node, substitutionDeps, (resolve, onUnresolved) => {
                substituteInTree(markdown, resolve, onUnresolved);
            });
            const root =
                info.code !== undefined || info.lang !== undefined
                    ? toRoot(toCode(info.lang || 'markdown', markdown))
                    : markdown;
            return { root, info };
        } catch (e) {
            const err = toError(e);
            // A merely missing markdown file stays a warning, but a boundary rejection is fatal
            // (ADR-0001) so `--stop-on-errors` applies and a failed run is visible in CI.
            if (err instanceof OutsideInjectionRootError) {
                file.error(err.message, directive.node.position);
            } else {
                file.message(err.message);
            }
            return { root: errorToComment(err), info };
        }
    }

    async function resolveAndReadFile(file: URL): Promise<VFileEx> {
        try {
            // Read the path the boundary check approved, not `file`, so the read can't follow a
            // symlink swapped in after the check (time-of-check/time-of-use).
            const readFrom = await resolveWithinInjectionRoot(file);
            return await readFile(fs, file, 'utf8', readFrom);
        } catch (e) {
            // console.log('resolveAndReadFile: (%s) %o', file.href, e);
            // A denial already names the boundary and the way around it; every other failure is
            // reported as a plain read failure, without saying why.
            if (e instanceof OutsideInjectionRootError) throw e;
            throw new Error(`Failed to read "${relativePathNormalized(file)}"`, { cause: e });
        }
    }

    /**
     * Local (`file:`) references must resolve inside the injection root (`cwd`) or one of
     * `allowOutsideRoot`'s directories; remote fetches are unaffected.
     * @returns the URL to read from: the symlink-resolved target for a local file, `target` as-is
     * for a remote reference.
     */
    async function resolveWithinInjectionRoot(target: URL): Promise<URL> {
        if (target.protocol !== 'file:') return target;
        const roots = await (injectionRootsPromise ??= resolveInjectionRoots(
            fs,
            options.cwd,
            options.allowOutsideRoot,
        ));
        // Textual gate first. Its verdict never depends on the target existing, so a denial can't
        // be used to probe which paths are present on the machine running the tool.
        assertWithinRoots(roots.textual, fileURLToPath(target), target);
        // Then the real path, which catches a symlink inside the root pointing outside it. Getting
        // here means the reference is textually in-root, so the symlink is one the tree already
        // contains — no denial below reveals anything about the wider filesystem.
        const realTarget = await fs.realpath(target);
        assertWithinRoots(roots.real, realTarget, target);
        return pathToFileURL(realTarget);
    }

    function assertWithinRoots(roots: string[], candidate: string, target: URL): void {
        if (roots.some((root) => isWithinRoot(root, candidate))) return;
        throw new OutsideInjectionRootError(
            `Access denied: "${relativePathNormalized(target)}" is outside the injection root;` +
                ' use --allow-outside-root to permit it.',
        );
    }

    function parseMarkdownFile(file: VFileEx): Root {
        return initParser(toInitOptions(file)).parse(file);
    }

    function relativePathNormalized(path: URL, relDir?: URL): string {
        return relativePath(relDir || file.data.cwdUrl || options.cwd, path).toString();
    }
}

function deleteInjectedContent(root: Root, file: VFileEx, endOffsets?: Map<Html, number>): Root {
    const directiveNodes = collectInjectionNodesAndParse(root);
    const pairs = findInjectionPairs(directiveNodes, file);

    if (endOffsets) {
        for (const pair of pairs) {
            const endOffset = pair.end?.node.position?.end.offset;
            if (pair.start && endOffset !== undefined) {
                endOffsets.set(pair.start.node, endOffset);
            }
        }
    }

    interface BaseNode {
        type: string;
    }

    const starts = new Set<BaseNode>(
        pairs
            .map((p) => p.end && p.start)
            .filter(isDefined)
            .map((d) => d.node),
    );
    const ends = new Set<BaseNode>(
        pairs
            .map((p) => p.start && p.end)
            .filter(isDefined)
            .map((d) => d.node),
    );
    const toDelete = new Set<BaseNode>(
        pairs
            .map((p) => p.end)
            .filter(isDefined)
            .map((d) => d.node),
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
        },
    );

    remove(root, (node: BaseNode) => toDelete.has(node));

    return root;
}

interface DirectivePair {
    start?: DirectiveNode | undefined;
    end?: DirectiveNode | undefined;
}

interface DirectiveNodeBase {
    node: Html;
    parent: Parent;
    directive: Directive | undefined;
}

interface DirectiveNode extends DirectiveNodeBase {
    directive: Directive;
}

/** `--inject-only` mode: threaded through the inject calls to collect patches. */
interface InjectOnlyCtx {
    outputOptions: StringifyOptions;
    /** original end-marker offset for each surviving start node, from a matched pair. */
    endOffsets: Map<Html, number>;
    lineEnding: string;
    patches: Patch[];
}

const startTypes: Record<DirectiveType, boolean> = {
    start: true,
    code: true,
    table: true,
    end: false,
} as const;

function isDirectiveNode(n: DirectiveNodeBase): n is DirectiveNode {
    return n.directive !== undefined;
}

function findInjectionPairs(nodes: DirectiveNodeBase[], vfile: VFileEx): DirectivePair[] {
    function validate(dn: DirectiveNodeBase): dn is DirectiveNode {
        if (!dn.directive) return false;
        const d = dn.directive;
        if (!d.type) {
            vfile.error('Unable to parse @@inject directive.', dn.node.position);
            return false;
        }
        if (!d.file?.href && d.type !== 'end') {
            vfile.error('Missing injection filename.', dn.node.position);
            return false;
        }
        return true;
    }

    const dNodes = nodes.filter(validate);

    const pairs: DirectivePair[] = [];
    let last: DirectiveNode | undefined = undefined;

    for (const dn of dNodes) {
        const n = dn.directive;
        if (startTypes[n.type]) {
            if (last) {
                pairs.push({ start: last });
            }
            last = dn;
            continue;
        }
        if (!last) {
            vfile.error(`Unmatched @@inject-end${n.file ? ` "${n.file}"` : ''}`, dn.node.position);
            pairs.push({ end: last });
            continue;
        }
        if (!refersToTheSameFile(last.directive.file, n.file)) {
            vfile.info(
                `@@inject-end${n.file ? ` "${n.file}"` : ''} matching with "${last.directive.file}"`,
                dn.node.position,
            );
        }
        pairs.push({ start: last, end: dn });
        last = undefined;
    }

    if (last) {
        pairs.push({ start: last });
    }

    return pairs;
}

function parseDirectiveNode(node: Html): Directive | undefined {
    return parseDirective(node.value);
}

function collectInjectionNodes(root: Root): DirectiveNodeBase[] {
    const nodes: DirectiveNodeBase[] = [];
    visit(root, isInjectNode, (node, _index, parent) => {
        if (parent) nodes.push({ node, parent, directive: undefined });
    });
    return nodes;
}

function collectInjectionNodesAndParse(root: Root): DirectiveNodeBase[] {
    const nodes: DirectiveNodeBase[] = collectInjectionNodes(root);

    const dNodes = nodes.map((node) => {
        const directive = parseDirectiveNode(node.node);
        return { ...node, directive };
    });
    return dNodes;
}

/**
 * @param path - the reference as written, kept as the resulting file's identity (it carries the
 *   directive's `#` options and drives extension-based decisions downstream).
 * @param readFrom - the location to actually read; defaults to `path`.
 */
async function readFile(
    fs: FileSystemAdapter,
    path: URL,
    encoding: BufferEncoding = 'utf8',
    readFrom: URL = path,
): Promise<VFileEx> {
    const value = await fs.readFile(readFrom, encoding);
    const data: FileData = {
        encoding,
        fileUrl: path,
    };
    // use path.pathname because Vfile blows up if it isn't a file: url.
    const file = new VFileEx(value, data);
    assert(isVFileEx(file));
    return file;
}

function detectLineEnding(content: string): string {
    const pos = content.indexOf('\n');
    return content[pos - 1] === '\r' ? '\r\n' : '\n';
}

function isInjectNode(n: unknown): n is Html {
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

function fixContentLineEndings(content: string, lineEnding: string, fixEofNewLine: boolean): string {
    const fixed = content.replace(/\r?\n/g, lineEnding);
    return fixEofNewLine && !hasEofNewLine(fixed) ? fixed + lineEnding : fixed;
}

function hasEofNewLine(content: string): boolean {
    return content[content.length - 1] === '\n';
}

function normalizeHref(href: string): string {
    return href.replace(/%20/g, ' ');
}

function extractLines(content: string, lines: [number, number] | undefined): string {
    if (!lines) return content;

    const cLines = content.split('\n');
    return cLines.slice(lines[0] - 1, lines[1]).join('\n');
}

function refersToTheSameFile(a: RelURL | URL | undefined, b: RelURL | URL | undefined): boolean {
    return a === b || (a && !b) || a?.pathname === b?.pathname;
}

interface InjectionRoots {
    /** The roots as given, for the check that must not touch the filesystem. */
    textual: string[];
    /** The same roots symlink-resolved, for the check that catches symlink escapes. */
    real: string[];
}

/**
 * The injection root and any `allowOutsideRoot` directories, in both forms the boundary check
 * needs. An unresolvable `allowOutsideRoot` entry (e.g. a typo'd path) is dropped from `real`
 * rather than failing the whole set — it couldn't have matched a directive's resolved target
 * anyway, and letting it reject here would otherwise deny every read in the file, including ones
 * inside the (still-valid) injection root.
 */
async function resolveInjectionRoots(
    fs: FileSystemAdapter,
    cwd: URL,
    allowOutsideRoot: string[] | undefined,
): Promise<InjectionRoots> {
    const extraDirs = (allowOutsideRoot ?? []).map((dir) => dirToUrl(dir));
    const root = await fs.realpath(cwd);
    const extras = await Promise.all(extraDirs.map((dir) => fs.realpath(dir).catch(() => undefined)));
    return {
        textual: [cwd, ...extraDirs].map((dir) => fileURLToPath(dir)),
        real: [root, ...extras.filter(isDefined)],
    };
}

/**
 * A reference that resolved outside the injection root, as opposed to one that simply couldn't be
 * read. Lets a caller treat the boundary rejection as fatal where a missing file is not.
 */
class OutsideInjectionRootError extends Error {}

function isWithinRoot(root: string, target: string): boolean {
    const rel = path.relative(root, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

interface ParserOptions {
    frontmatter?: boolean;
    gfm?: boolean;
}

function initParser(options: ParserOptions) {
    if (options.frontmatter) {
        return unified().use(remarkParse).use(remarkFrontmatter, ['yaml', 'toml']).use(remarkGfm);
    }
    return unified().use(remarkParse).use(remarkGfm);
}

function toInitOptions(file: VFileEx): ParserOptions {
    const options: ParserOptions = { gfm: true };
    if (file.content.startsWith('---\n')) {
        options.frontmatter = true;
    }
    return options;
}

interface ParseResult {
    root: Root;
    info: InjectInfo;
}

import { FileInjector, type FileInjectorOptions, type ProcessFileResult } from './FileInjector/FileInjector.js';
import { nodeFsa } from './FileSystemAdapter/fsa.js';
import { processGlobs } from './processor/process.mjs';
import { OptionError } from './util/errors.js';
import { isValidValuesFilePrefix, type ValueDeclaration as InternalValueDeclaration } from './util/values.js';

/**
 * Options shared by {@link injectFiles} and {@link injectMarkdown}. Fields picked from
 * `FileInjectorOptions` are documented there.
 */
export interface InjectOptions extends Pick<
    FileInjectorOptions,
    'cwd' | 'allowOutsideRoot' | 'allowEnv' | 'strictVars' | 'rebaseLinks' | 'clean' | 'injectOnly'
> {
    /**
     * Run-wide `{@ name @}` placeholder value declarations, oldest to newest; a newer one wins,
     * whatever its kind. Like `--value`, `--values-file` and `--value-alias` in command-line order.
     */
    values?: ValueDeclaration[] | undefined;
}

/** A run-wide placeholder value declaration. */
export type ValueDeclaration =
    /** `{@ name @}` is `value`. Like `--value name=value`. */
    | { name: string; value: string }
    /**
     * A JSON file of values, relative to `cwd`. Like `--values-file`. Its values go under
     * `prefix`; with no `prefix`, under the file's base name (`package.json` → `package`); with
     * `prefix: ''`, at the root.
     */
    | { file: string; prefix?: string | undefined }
    /** Resolve `{@ alias @}` as if it were `{@ target @}`. Like `--value-alias alias=target`. */
    | { alias: string; target: string };

export interface InjectFilesOptions
    extends
        InjectOptions,
        Pick<FileInjectorOptions, 'outputDir' | 'stopOnErrors' | 'writeOnError' | 'dryRun' | 'silent' | 'verbose'> {
    /**
     * Throw if the patterns match no Markdown files. `false` is like `--no-must-find-files`.
     * @default true
     */
    mustFindFiles?: boolean | undefined;
}

export interface InjectMarkdownOptions extends InjectOptions {
    /** The path of the Markdown, relative to `cwd`. Relative `@@inject` references resolve from it. */
    file: string;
}

/** An error or warning reported for a Markdown file. */
export interface InjectMessage {
    /** The Markdown file, as matched (relative to `cwd`) or as given to {@link injectMarkdown}. */
    file: string;
    message: string;
    /** 1-based line of the directive, if known. */
    line?: number | undefined;
    /** 1-based column of the directive, if known. */
    column?: number | undefined;
}

export interface InjectFilesResult {
    /** Markdown files matched by the patterns. */
    filesFound: number;
    filesProcessed: number;
    filesWithInjections: number;
    /** Files whose content changed (or, with `dryRun`, would change). */
    filesUpdated: number;
    filesWritten: number;
    /** Files not written because of an error or `dryRun`. */
    filesSkipped: number;
    errors: InjectMessage[];
    warnings: InjectMessage[];
}

/** Thrown by {@link injectFiles} when no files match, and by {@link injectMarkdown} on injection errors. */
export class InjectMarkdownError extends Error {
    constructor(
        message: string,
        readonly errors: InjectMessage[] = [],
    ) {
        super(message);
        this.name = 'InjectMarkdownError';
    }
}

/**
 * Inject content into Markdown files, like the CLI, without printing or exiting.
 * Errors in the files are returned in `errors`; invalid options throw.
 * Defaults match the CLI, except `silent`, which defaults to `true`.
 * @param files - files or glob patterns, relative to `cwd`; only `.md` files are processed.
 */
export async function injectFiles(files: string[], options: InjectFilesOptions = {}): Promise<InjectFilesResult> {
    const errors: InjectMessage[] = [];
    const warnings: InjectMessage[] = [];
    const collect = (relFile: string, r: ProcessFileResult) => collectMessages(relFile, r, errors, warnings);
    const { mustFindFiles = true, stopOnErrors = true, silent = true, ...opts } = options;
    const r = await processGlobs(files, { ...toInjectorOptions(opts), mustFindFiles, stopOnErrors, silent }, collect);
    if (!r.numberOfFiles && mustFindFiles) throw new InjectMarkdownError('No Markdown files found.');
    return {
        filesFound: r.numberOfFiles,
        filesProcessed: r.numberOfFilesProcessed,
        filesWithInjections: r.numberOfFilesWithInjections,
        filesUpdated: r.numberOfFilesUpdated,
        filesWritten: r.numberOfFilesWritten,
        filesSkipped: r.numberOfFilesSkipped,
        errors,
        warnings,
    };
}

/**
 * Inject content into a Markdown string and return the result. Nothing is written.
 * @throws {InjectMarkdownError} if an injection fails.
 */
export async function injectMarkdown(markdown: string, options: InjectMarkdownOptions): Promise<string> {
    const { file, ...opts } = options;
    const injector = new FileInjector(nodeFsa(), { ...toInjectorOptions(opts), silent: true, dryRun: true });
    const r = await injector.processContent(markdown, file);
    const errors: InjectMessage[] = [];
    collectMessages(file, r, errors, []);
    if (errors.length) {
        const details = errors.map((e) => `\n  ${e.line ?? 0}:${e.column ?? 0} ${e.message}`).join('');
        throw new InjectMarkdownError(`Failed to inject into ${file}:${details}`, errors);
    }
    return String(r.file.value);
}

function toInjectorOptions(options: InjectFilesOptions): FileInjectorOptions {
    const { values, ...rest } = options;
    return { ...rest, valueDeclarations: values?.map(toInternalDeclaration) };
}

function toInternalDeclaration(decl: ValueDeclaration): InternalValueDeclaration {
    if ('alias' in decl) return { kind: 'alias', name: decl.alias, target: decl.target };
    if ('name' in decl) return { kind: 'value', name: decl.name, value: decl.value };
    const { file: path, prefix } = decl;
    if (prefix === undefined) return { kind: 'values-file', entry: { prefixKind: 'auto', path } };
    if (prefix === '') return { kind: 'values-file', entry: { prefixKind: 'root', path } };
    if (!isValidValuesFilePrefix(prefix)) throw new OptionError(`Invalid values file prefix: "${prefix}"`);
    return { kind: 'values-file', entry: { prefixKind: 'explicit', prefixName: prefix, path } };
}

function collectMessages(file: string, r: ProcessFileResult, errors: InjectMessage[], warnings: InjectMessage[]) {
    for (const m of r.file.messages) {
        const msg: InjectMessage = { file, message: m.reason, line: m.line, column: m.column };
        (m.fatal ? errors : warnings).push(msg);
    }
}

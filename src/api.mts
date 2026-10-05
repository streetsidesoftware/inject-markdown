import { FileInjector, type FileInjectorOptions, type ProcessFileResult } from './FileInjector/FileInjector.js';
import { nodeFsa } from './FileSystemAdapter/fsa.js';
import { processGlobs } from './processor/process.mjs';

export type {
    ValueAliasDeclaration,
    ValueDeclaration,
    ValuePairDeclaration,
    ValuesFileDeclaration,
} from './util/values.js';

/**
 * Options shared by {@link injectFiles} and {@link injectMarkdown}. Fields picked from
 * `FileInjectorOptions` are documented there.
 */
export type InjectOptions = Pick<
    FileInjectorOptions,
    | 'cwd'
    | 'allowOutsideRoot'
    | 'valueDeclarations'
    | 'allowEnv'
    | 'strictVars'
    | 'rebaseLinks'
    | 'clean'
    | 'injectOnly'
>;

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
    const r = await processGlobs(files, { ...opts, mustFindFiles, stopOnErrors, silent }, collect);
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
    const injector = new FileInjector(nodeFsa(), { ...opts, silent: true, dryRun: true });
    const r = await injector.processContent(markdown, file);
    const errors: InjectMessage[] = [];
    collectMessages(file, r, errors, []);
    if (errors.length) {
        const details = errors.map((e) => `\n  ${e.line ?? 0}:${e.column ?? 0} ${e.message}`).join('');
        throw new InjectMarkdownError(`Failed to inject into ${file}:${details}`, errors);
    }
    return String(r.file.value);
}

function collectMessages(file: string, r: ProcessFileResult, errors: InjectMessage[], warnings: InjectMessage[]) {
    for (const m of r.file.messages) {
        const msg: InjectMessage = { file, message: m.reason, line: m.line, column: m.column };
        (m.fatal ? errors : warnings).push(msg);
    }
}

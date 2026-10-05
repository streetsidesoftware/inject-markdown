import { FileInjector, type FileInjectorOptions, type ProcessFileResult } from './FileInjector/FileInjector.js';
import { nodeFsa } from './FileSystemAdapter/fsa.js';
import { processGlobs } from './processor/process.mjs';
import { parseValuesFileEntry, type ValueDeclaration } from './util/values.js';

/** Options shared by {@link injectFiles} and {@link injectMarkdown}. */
export interface InjectOptions {
    /**
     * The injection root: relative paths resolve against it, and local `@@inject` references must
     * stay inside it. Like `--cwd`.
     * @default process.cwd()
     */
    cwd?: string | undefined;
    /** Directories outside `cwd` that local references may resolve into. Like `--allow-outside-root`. */
    allowOutsideRoot?: string[] | undefined;
    /** Run-wide `{@ name @}` placeholder values. Like `--value name=val`. */
    values?: Record<string, string> | undefined;
    /** JSON files of placeholder values, as `[prefix:]path` relative to `cwd`. Like `--values-file`. */
    valuesFiles?: string[] | undefined;
    /** Resolve `{@ new @}` as if it were `{@ target @}`, as `{ new: target }`. Like `--value-alias`. */
    valueAliases?: Record<string, string> | undefined;
    /** Environment variables a directive may reference via `{@ env.NAME @}`. Like `--allow-env`. */
    allowEnv?: string[] | undefined;
    /** Treat an unresolved placeholder as an error. Like `--strict-vars`. */
    strictVars?: boolean | undefined;
    /**
     * Rebase relative links in injected Markdown onto the host file. `false` is like `--no-rebase-links`.
     * @default true
     */
    rebaseLinks?: boolean | undefined;
    /** Remove injected content, keeping the directives. Like `--clean`. */
    clean?: boolean | undefined;
    /**
     * Only rewrite the injected sections, leaving the rest of the file byte-for-byte as is.
     * `false` is like `--no-inject-only`.
     * @default true
     */
    injectOnly?: boolean | undefined;
}

export interface InjectFilesOptions extends InjectOptions {
    /** Write the results to this directory instead of in place. Like `--output-dir`. */
    outputDir?: string | undefined;
    /**
     * Throw if the patterns match no Markdown files. `false` is like `--no-must-find-files`.
     * @default true
     */
    mustFindFiles?: boolean | undefined;
    /**
     * Stop at the first file with an error. `false` is like `--no-stop-on-errors`.
     * @default true
     */
    stopOnErrors?: boolean | undefined;
    /** Write a file even if an injection in it failed. Like `--write-on-error`. */
    writeOnError?: boolean | undefined;
    /** Process the files, but don't write anything. Like `--dry-run`. */
    dryRun?: boolean | undefined;
    /**
     * Don't print progress to stderr. Errors are never printed; they are returned.
     * @default true
     */
    silent?: boolean | undefined;
    /** With `silent: false`, also print each injected reference. Like `--verbose`. */
    verbose?: boolean | undefined;
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
 * @param files - files or glob patterns, relative to `cwd`; only `.md` files are processed.
 */
export async function injectFiles(files: string[], options: InjectFilesOptions = {}): Promise<InjectFilesResult> {
    const errors: InjectMessage[] = [];
    const warnings: InjectMessage[] = [];
    const collect = (relFile: string, r: ProcessFileResult) => collectMessages(relFile, r, errors, warnings);
    const { mustFindFiles = true, stopOnErrors = true, silent = true, ...opts } = options;
    const r = await processGlobs(
        files,
        { ...toInjectorOptions(opts), mustFindFiles, stopOnErrors, silent, cwd: opts.cwd, dryRun: opts.dryRun },
        collect,
    );
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
    const { values, valuesFiles, valueAliases, injectOnly = true, ...rest } = options;
    // Later declarations win: values files, then values, then aliases.
    const valueDeclarations: ValueDeclaration[] = [
        ...(valuesFiles ?? []).map((p): ValueDeclaration => ({ kind: 'values-file', entry: parseValuesFileEntry(p) })),
        ...Object.entries(values ?? {}).map(([name, value]): ValueDeclaration => ({ kind: 'value', name, value })),
        ...Object.entries(valueAliases ?? {}).map(([name, target]): ValueDeclaration => ({
            kind: 'alias',
            name,
            target,
        })),
    ];
    return { ...rest, injectOnly, valueDeclarations };
}

function collectMessages(file: string, r: ProcessFileResult, errors: InjectMessage[], warnings: InjectMessage[]) {
    for (const m of r.file.messages) {
        const msg: InjectMessage = { file, message: m.reason, line: m.line, column: m.column };
        (m.fatal ? errors : warnings).push(msg);
    }
}

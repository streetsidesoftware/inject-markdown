import { FileInjector, type InjectOptions, type ProcessFileResult } from './FileInjector/FileInjector.js';
import { nodeFsa } from './FileSystemAdapter/fsa.js';
import { OptionError } from './util/errors.js';
import { isValidPlaceholderName, type ValueDeclaration } from './util/values.js';

export type { InjectOptions } from './FileInjector/FileInjector.js';
export { removeDirectives } from './FileInjector/removeDirectives.js';
export type {
    ValueAliasDeclaration,
    ValueDeclaration,
    ValuePairDeclaration,
    ValuesFileDeclaration,
} from './util/values.js';

/** Markdown text and the path it belongs to. */
export interface MarkdownDocument {
    /** The document's path, relative to `cwd`. Relative `@@inject` references resolve from it. */
    file: string;
    /** The Markdown text. */
    content: string;
}

/** An error or warning about the Markdown. */
export interface InjectMessage {
    message: string;
    /** 1-based line of the directive, if known. */
    line?: number | undefined;
    /** 1-based column of the directive, if known. */
    column?: number | undefined;
}

/** What happened to a Markdown file. */
export interface InjectFileResult {
    /** The content changed. */
    updated: boolean;
    /** The file was written. */
    written: boolean;
    errors: InjectMessage[];
    warnings: InjectMessage[];
}

/** The document after injection, and what happened. */
export interface InjectMarkdownResult {
    /** The document after injection: the same `file`, with the new `content`. */
    document: MarkdownDocument;
    /** The content changed. */
    updated: boolean;
    errors: InjectMessage[];
    warnings: InjectMessage[];
}

/**
 * Inject content into a Markdown file.
 * The file is written back only if it changed and had no errors.
 * - Errors in the Markdown are returned in `errors`.
 * - Invalid options throw an `OptionError`.
 * @param file - the Markdown file, relative to `cwd`.
 */
export async function injectFile(file: string, options: InjectOptions = {}): Promise<InjectFileResult> {
    assertValidValuesFilePrefixes(options.valueDeclarations);
    const injector = new FileInjector(nodeFsa(), { ...options, silent: true });
    const r = await injector.processFile(file);
    return { updated: r.hasChanged, written: r.written, ...collectMessages(r) };
}

/**
 * Inject content into a Markdown document. Nothing is read from its `file` or written.
 * - Errors in the Markdown are returned in `errors`.
 * - Invalid options throw an `OptionError`.
 */
export async function injectMarkdown(
    document: MarkdownDocument,
    options: InjectOptions = {},
): Promise<InjectMarkdownResult> {
    assertValidValuesFilePrefixes(options.valueDeclarations);
    const injector = new FileInjector(nodeFsa(), { ...options, silent: true, dryRun: true });
    const r = await injector.processContent(document.content, document.file);
    const injected: MarkdownDocument = { file: document.file, content: String(r.file.value) };
    return { document: injected, updated: r.hasChanged, ...collectMessages(r) };
}

/**
 * Assert that every values file's prefix can be used.
 * A prefix is `''` or a name such as `package` or `pkg.build`.
 * Throws an `OptionError` for one that isn't.
 */
function assertValidValuesFilePrefixes(decls: ValueDeclaration[] | undefined): void {
    for (const decl of decls ?? []) {
        if (decl.kind !== 'values-file' || decl.prefix === '' || isValidPlaceholderName(decl.prefix)) {
            continue;
        }
        throw new OptionError(`Invalid prefix "${decl.prefix}" for values file "${decl.path}".`);
    }
}

function collectMessages(r: ProcessFileResult): { errors: InjectMessage[]; warnings: InjectMessage[] } {
    const errors: InjectMessage[] = [];
    const warnings: InjectMessage[] = [];
    for (const m of r.file.messages) {
        const msg: InjectMessage = { message: m.reason, line: m.line, column: m.column };
        if (m.fatal) {
            errors.push(msg);
        } else {
            warnings.push(msg);
        }
    }
    return { errors, warnings };
}

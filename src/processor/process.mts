import { fileURLToPath } from 'node:url';

import { globby, type Options as GlobbyOptions } from 'globby';
import * as path from 'path';

import { FileInjector, type FileInjectorOptions, type ProcessFileResult } from '../FileInjector/FileInjector.js';
import type { PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { nodeFsa } from '../FileSystemAdapter/fsa.js';
import { reportFileErrors } from './reportFileErrors.mjs';

const excludes = ['node_modules'];
const allowedFileExtensions: Record<string, boolean | undefined> = {
    '.md': true,
};

/**
 * @param onFileResult - called with each processed file's result.
 *   By default, it prints the file's errors and warnings to stderr.
 */
export async function processGlobs(
    globs: string[],
    options: Options,
    onFileResult: (relFile: string, r: ProcessFileResult) => void = printFileErrors,
): Promise<Result> {
    const fs = nodeFsa();

    const result: Result = {
        numberOfFiles: 0,
        numberOfFilesProcessed: 0,
        numberOfFilesWithInjections: 0,
        numberOfFilesUpdated: 0,
        numberOfFilesWritten: 0,
        numberOfFilesSkipped: 0,
        filesWithErrors: [],
        errorCount: 0,
    };
    if (!globs.length) return result;

    const files = await findFiles(globs, options.cwd);

    result.numberOfFiles = files.length;
    const injector = new FileInjector(fs, options);
    for (const file of files) {
        const r = await injector.processFile(file);
        result.numberOfFilesProcessed += 1;
        result.numberOfFilesWithInjections += r.injectionsFound ? 1 : 0;
        result.numberOfFilesWritten += r.written ? 1 : 0;
        result.numberOfFilesUpdated += r.hasChanged ? 1 : 0;
        result.numberOfFilesSkipped += r.skipped ? 1 : 0;
        onFileResult(file, r);
        if (r.hasErrors) {
            result.errorCount += 1;
            result.filesWithErrors.push(file);
            if (options.stopOnErrors ?? true) break;
        }
    }

    return result;
}

function printFileErrors(_relFile: string, r: ProcessFileResult): void {
    if (!r.hasErrors && !r.hasMessages) return;
    console.error(reportFileErrors(r.file));
}

export interface Options extends FileInjectorOptions {
    mustFindFiles: boolean;
}

async function findFiles(globs: string[], cwd: PathLike | undefined) {
    const cwdToUse = path.resolve(cwd instanceof URL ? fileURLToPath(cwd) : cwd || '.');
    const options: Mutable<GlobbyOptions> = {
        ignore: excludes,
        onlyFiles: true,
        cwd: cwdToUse,
    };
    const files = await globby(
        globs.map((a) => a.trim()).filter((a) => !!a),
        options,
    );
    // console.log('%o', files);
    return files.filter((f) => path.extname(f) in allowedFileExtensions);
}

export interface Result {
    numberOfFiles: number;
    numberOfFilesProcessed: number;
    numberOfFilesWithInjections: number;
    numberOfFilesUpdated: number;
    numberOfFilesWritten: number;
    numberOfFilesSkipped: number;
    filesWithErrors: string[];
    errorCount: number;
}

type Mutable<Type> = {
    -readonly [Key in keyof Type]: Type[Key];
};

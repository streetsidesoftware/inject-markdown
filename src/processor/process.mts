import { isMainThread } from 'node:worker_threads';

import { globby, type Options as GlobbyOptions } from 'globby';
import * as path from 'path';

import { nodeFsa } from '../FileSystemAdapter/fsa.js';
import { reportFileErrors } from './reportFileErrors.mjs';
import { FileInjector, type FileInjectorOptions } from '../FileInjector/FileInjector.js';

const excludes = ['node_modules'];
const allowedFileExtensions: Record<string, boolean | undefined> = {
    '.md': true,
};



export async function processGlobs(globs: string[], options: Options): Promise<Result> {
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
        if (r.hasErrors || r.hasMessages) {
            result.errorCount += r.hasErrors ? 1 : 0;
            if (r.hasErrors) result.filesWithErrors.push(file);
            console.error(reportFileErrors(r.file));
            if (r.hasErrors && (options.stopOnErrors ?? true)) break;
        }
    }

    return result;
}

export interface Options extends FileInjectorOptions {
    mustFindFiles: boolean;
    cwd?: string;
    dryRun?: boolean;
}

async function findFiles(globs: string[], cwd: string | undefined) {
    const _cwd = process.cwd();
    const cwdToUse = path.resolve(cwd || '.');
    if (cwd && isMainThread) process.chdir(cwdToUse);
    const options: Mutable<GlobbyOptions> = {
        ignore: excludes,
        onlyFiles: true,
        cwd: cwdToUse,
    };
    const files = await globby(
        globs.map((a) => a.trim()).filter((a) => !!a),
        options,
    );
    if (isMainThread) process.chdir(_cwd);
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

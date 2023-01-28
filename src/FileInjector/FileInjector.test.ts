import { fileURLToPath, pathToFileURL } from 'node:url';

import * as path from 'path';
import { format } from 'util';
import { describe, expect, MockedFunction, test, vi } from 'vitest';

import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { nodeFsa } from '../FileSystemAdapter/fsa.js';
import { createStore, normalizePath, type Store } from '../FileSystemAdapter/fsStore.mjs';
import { relativePath } from '../util/url_helper.js';
import { FileInjector, Logger } from './FileInjector.js';

const __file__ = fileURLToPath(import.meta.url);
const __dirname__ = path.dirname(__file__);
const __root__ = path.join(__dirname__, '../..');

const appFsa = nodeFsa();

const oc = (e: unknown) => expect.objectContaining(e);

describe('FileInjector', () => {
    test('FileInjector', () => {
        const fi = new FileInjector(createFSA(), {});
        expect(fi).toBeDefined();
    });

    test.each`
        file           | options                              | expectedResult
        ${'README.md'} | ${{ cwd: 'fixtures/no-injections' }} | ${oc({ hasChanged: false })}
    `('processFile no change', async ({ file, options, expectedResult }) => {
        options.cwd = options.cwd || __root__;
        options.logger = createLogger();
        const fsa = createFSA();
        const fi = new FileInjector(fsa, options);
        const r = await fi.processFile(file);
        expect(r).toEqual(expectedResult);
        expect(fsa.mkdir).not.toBeCalled();
    });

    test.each`
        file                                 | options                                                  | expectedResult               | expectedFile
        ${'fixtures/vacations/vacations.md'} | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_' }}                                | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_', verbose: true }}                 | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_', silent: true }}                  | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'vacations.md'}                    | ${{ cwd: 'fixtures/vacations/', outputDir: '_out_' }}    | ${oc({ hasChanged: true })}  | ${'_out_/vacations.md'}
        ${'README.md'}                       | ${{ cwd: 'fixtures/no-injections', outputDir: '_out_' }} | ${oc({ hasChanged: false })} | ${'_out_/README.md'}
        ${'fixtures/code/README.md'}         | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/code/README.md'}
    `('processFile $file $options', async ({ file, options, expectedResult, expectedFile }) => {
        const logger = createLogger();
        options.cwd = options.cwd || __root__;
        options.color = options.color ?? false;
        options.logger = logger;
        expectedFile = path.resolve(__root__, expectedFile);
        const fsa = createFSA();
        const fi = new FileInjector(fsa, options);
        const r = await fi.processFile(file);
        expect(r).toEqual(expectedResult);
        expect(fsa.mkdir).toHaveBeenCalledWith(path.dirname(expectedFile), { recursive: true });
        expect(normalizeWriteFileCalls(fsa.writeFile)).toMatchSnapshot();
        expect(logger.history).toMatchSnapshot();
    });

    test.each`
        file                                 | options                                 | expectedResult
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_' }}               | ${oc({ hasChanged: true, skipped: false, written: true })}
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_', dryRun: true }} | ${oc({ hasChanged: true, skipped: true, written: false })}
    `('processFile($file, $options)', async ({ file, options, expectedResult }) => {
        const logger = createLogger();
        options.cwd = options.cwd || __root__;
        options.color = options.color ?? false;
        options.logger = logger;
        const fsa = createFSA();
        const fi = new FileInjector(fsa, options);
        const r = await fi.processFile(file);
        expect(r).toEqual(expectedResult);
        expect(normalizeWriteFileCalls(fsa.writeFile)).toMatchSnapshot();
        expect(logger.history).toMatchSnapshot();
    });
});

function normalizeWriteFileCalls(
    writeFile: MockedFileSystemAdapter['writeFile']
): MockedFileSystemAdapter['writeFile']['mock']['calls'] {
    const calls = writeFile.mock.calls;
    const cwd = pathToFileURL('.');
    const normalized = calls.map(
        ([pathLike, data, encoding]) =>
            [relativePath(cwd, normalizePath(pathLike)).toString(), data, encoding] as Parameters<
                FileSystemAdapter['writeFile']
            >
    );
    return normalized;
}

type MockedFileSystemAdapter<T extends FileSystemAdapter = FileSystemAdapter> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]: T[K] extends (...args: any) => any ? MockedFunction<T[K]> : T[K];
};
interface FSA extends MockedFileSystemAdapter {
    store: Store<string>;
}

function createFSA(): FSA {
    const store = createStore<string>();

    async function readFile(p: PathLike, e: BufferEncoding): Promise<string> {
        const found = store.get(p);
        if (typeof found === 'string') return found;
        const data = await appFsa.readFile(p, e);
        store.set(p, data);
        return data;
    }

    async function writeFile(file: PathLike, data: string, _encoding: string) {
        store.set(file, data);
    }

    const fsaMethods: FileSystemAdapter = {
        readFile: vi.fn().mockImplementation(readFile),
        writeFile: vi.fn().mockImplementation(writeFile),
        mkdir: vi.fn().mockImplementation(async (_path: PathLike) => undefined),
    };

    const ma = fsaMethods as MockedFileSystemAdapter;

    const fsa: FSA = {
        ...ma,
        store,
    };

    return fsa;
}

function createLogger() {
    type Target = 'error' | 'log' | 'warn' | 'stdout' | 'stderr';
    const history: { target: Target; text: string }[] = [];

    function f(target: Target): typeof console.log {
        function log(...params: Parameters<typeof console.log>) {
            history.push({ target, text: format(...params) });
        }
        return log;
    }
    const log = f('log');
    const error = f('error');
    const warn = f('warn');
    const stderr = f('stderr');
    const stdout = f('stdout');

    const logger = {
        log: vi.fn().mockImplementation(log),
        error: vi.fn(error),
        warn: vi.fn(warn),
        writeStdout: vi.fn((t) => stdout(t)),
        writeStderr: vi.fn((t) => stderr(t)),
        history,
    };
    return logger satisfies Logger;
}

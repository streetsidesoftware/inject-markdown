import { describe, expect, MockedFunction, test, vi } from 'vitest';
import type { FileSystemAdapter, PathLike } from './FileSystemAdapter.js';
import { FileInjector } from './FileInjector.js';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'path';

const __file__ = fileURLToPath(import.meta.url);
const __dirname__ = path.dirname(__file__);
const __root__ = path.join(__dirname__, '..');

describe('FileInjector', () => {
    test('FileInjector', () => {
        const fi = new FileInjector(createFSA(), {});
        expect(fi).toBeDefined();
    });

    test.each`
        file           | options | expectedResult
        ${'README.md'} | ${{}}   | ${false}
    `('processFile no change', async ({ file, options, expectedResult }) => {
        file = path.resolve(__root__, file);
        options.cwd = options.cwd || __root__;
        const fsa = createFSA();
        const fi = new FileInjector(fsa, options);
        const r = await fi.processFile(file);
        expect(r).toBe(expectedResult);
        expect(fsa.mkdir).not.toBeCalled();
    });

    test.each`
        file                                 | options                                               | expectedResult | expectedFile
        ${'fixtures/vacations/vacations.md'} | ${{}}                                                 | ${true}        | ${'fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'} | ${{ outputDir: '_out_' }}                             | ${true}        | ${'_out_/fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'} | ${{ cwd: 'fixtures/vacations/', outputDir: '_out_' }} | ${true}        | ${'_out_/vacations.md'}
        ${'README.md'}                       | ${{ outputDir: '_out_' }}                             | ${false}       | ${'_out_/README.md'}
    `('processFile', async ({ file, options, expectedResult, expectedFile }) => {
        file = path.resolve(__root__, file);
        options.cwd = options.cwd || __root__;
        expectedFile = path.resolve(__root__, expectedFile);
        const fsa = createFSA();
        const fi = new FileInjector(fsa, options);
        const r = await fi.processFile(file);
        expect(r).toBe(expectedResult);
        expect(fsa.mkdir).toHaveBeenCalledWith(path.dirname(expectedFile), { recursive: true });
        expect(normalizeWriteFileCalls(fsa.writeFile)).toMatchSnapshot();
    });
});

function normalizeWriteFileCalls(
    writeFile: MockedFileSystemAdapter['writeFile']
): MockedFileSystemAdapter['writeFile']['mock']['calls'] {
    const calls = writeFile.mock.calls;
    const normalized = calls.map(
        ([pathLike, data, encoding]) =>
            [normalizePath(pathLike), data, encoding] as Parameters<FileSystemAdapter['writeFile']>
    );
    return normalized;
}

function normalizePath(pathLike: PathLike): PathLike {
    if (typeof pathLike !== 'string') return pathLike;

    const p = path.relative(__root__, pathLike);
    return p.replace(/\\/g, '/');
}

type MockedFileSystemAdapter<T extends FileSystemAdapter = FileSystemAdapter> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]: T[K] extends (...args: any) => any ? MockedFunction<T[K]> : T[K];
};

interface Store {
    get(file: PathLike): string | undefined;
    set(file: PathLike, data: string | undefined): void;
}

function createStore(): Store {
    const store = new Map<string, string>();

    function get(file: PathLike) {
        const p = normalizePath(file).toString();
        return store.get(p);
    }

    function set(file: PathLike, data: string | undefined) {
        const p = normalizePath(file).toString();
        if (typeof data !== 'string') {
            store.delete(p);
            return;
        }
        store.set(p, data);
    }

    return { get, set };
}

interface FSA extends MockedFileSystemAdapter {
    store: Store;
}

function createFSA(): FSA {
    const store = createStore();

    async function readFile(p: PathLike, e: BufferEncoding): Promise<string> {
        const found = store.get(p);
        if (typeof found === 'string') return found;
        const data = await fs.readFile(p, e);
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
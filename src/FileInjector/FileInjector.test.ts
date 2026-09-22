import { fileURLToPath, pathToFileURL } from 'node:url';

import * as path from 'path';
import { format } from 'util';
import { describe, expect, type MockedFunction, test, vi } from 'vitest';

import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { nodeFsa } from '../FileSystemAdapter/fsa.js';
import { createStore, normalizePath, type Store } from '../FileSystemAdapter/fsStore.mjs';
import { OptionError } from '../util/errors.js';
import { relativePath } from '../util/url_helper.js';
import { FileInjector, type Logger } from './FileInjector.js';

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
        file           | options                                                                | expectedResult
        ${'README.md'} | ${{ cwd: 'fixtures/no-injections' }}                                   | ${oc({ hasChanged: false })}
        ${'README.md'} | ${{ cwd: 'fixtures/no-injections', outputDir: '_out_', dryRun: true }} | ${oc({ hasChanged: false })}
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
        file                                   | options                                                  | expectedResult               | expectedFile
        ${'fixtures/vacations/vacations.md'}   | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'}   | ${{ outputDir: '_out_' }}                                | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'}   | ${{ outputDir: '_out_', verbose: true }}                 | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'fixtures/vacations/vacations.md'}   | ${{ outputDir: '_out_', silent: true }}                  | ${oc({ hasChanged: true })}  | ${'_out_/fixtures/vacations/vacations.md'}
        ${'vacations.md'}                      | ${{ cwd: 'fixtures/vacations/', outputDir: '_out_' }}    | ${oc({ hasChanged: true })}  | ${'_out_/vacations.md'}
        ${'README.md'}                         | ${{ cwd: 'fixtures/no-injections', outputDir: '_out_' }} | ${oc({ hasChanged: false })} | ${'_out_/README.md'}
        ${'fixtures/code/README.md'}           | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/code/README.md'}
        ${'fixtures/code/frontmatter.md'}      | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/code/frontmatter.md'}
        ${'fixtures/quotes/README.md'}         | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/quotes/README.md'}
        ${'fixtures/headers/README.md'}        | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/headers/README.md'}
        ${'fixtures/tables/README.md'}         | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/tables/README.md'}
        ${'fixtures/style-preserve/README.md'} | ${{}}                                                    | ${oc({ hasChanged: true })}  | ${'fixtures/style-preserve/README.md'}
        ${'fixtures/inject-only/README.md'}    | ${{ injectOnly: true }}                                  | ${oc({ hasChanged: true })}  | ${'fixtures/inject-only/README.md'}
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

describe('injectOnly', () => {
    const fixtureFile = 'fixtures/inject-only/README.md';
    const fixtureUrl = pathToFileURL(path.join(__root__, fixtureFile));

    async function inject(fsa: FSA, options: Record<string, unknown> = {}) {
        const fi = new FileInjector(fsa, { injectOnly: true, cwd: __root__, silent: true, ...options });
        return fi.processFile(fixtureFile);
    }

    test('preserves everything outside the injected span byte-for-byte', async () => {
        const source = await appFsa.readFile(fixtureUrl, 'utf8');
        const directive = '<!--- @@inject: snippet.md --->';
        const directiveIndex = source.indexOf(directive);
        expect(directiveIndex).toBeGreaterThan(-1);
        const prefix = source.slice(0, directiveIndex);

        const fsa = createFSA();
        const r = await inject(fsa);
        expect(r.hasChanged).toBe(true);

        const written = r.file.value as string;
        expect(written.startsWith(prefix)).toBe(true);
        expect(written.endsWith('<!--- @@inject-end: snippet.md --->\n')).toBe(true);
        // The setext heading and the double blank line, which a whole-document
        // restringify would normalize, must survive untouched.
        expect(written).toContain('Inject Only\n===========\n');
        expect(written).toContain('untouched.\n\n\nThere are two blank lines');
    });

    test('a second run over already-injected content is a no-op', async () => {
        const fsa = createFSA();
        const r1 = await inject(fsa);

        const fsa2 = createFSA();
        fsa2.store.set(fixtureUrl, r1.file.value as string);
        const r2 = await inject(fsa2);
        expect(r2.hasChanged).toBe(false);
        expect(r2.file.value).toBe(r1.file.value);
    });

    test('updating the injected file only changes the injected span', async () => {
        const fsa = createFSA();
        const r1 = await inject(fsa);

        const fsa2 = createFSA();
        fsa2.store.set(fixtureUrl, r1.file.value as string);
        fsa2.store.set(pathToFileURL(path.join(__root__, 'fixtures/inject-only/snippet.md')), 'Updated content!\n');
        const r2 = await inject(fsa2);
        expect(r2.hasChanged).toBe(true);

        const before = r1.file.value as string;
        const after = r2.file.value as string;
        const endDirective = '<!--- @@inject-end: snippet.md --->';
        const directiveIndex = before.indexOf('<!--- @@inject: snippet.md --->');
        // The injected body's length changes, so the two texts only realign
        // once the (identical) end marker starts.
        expect(after.slice(0, directiveIndex)).toBe(before.slice(0, directiveIndex));
        expect(after.slice(after.indexOf(endDirective))).toBe(before.slice(before.indexOf(endDirective)));
        expect(after).toContain('Updated content!');
    });

    test('--clean --inject-only removes the injected body but restores the original bytes', async () => {
        const original = await appFsa.readFile(fixtureUrl, 'utf8');

        const fsa = createFSA();
        const r1 = await inject(fsa);

        const fsa2 = createFSA();
        fsa2.store.set(fixtureUrl, r1.file.value as string);
        const r2 = await inject(fsa2, { clean: true });
        expect(r2.hasChanged).toBe(true);
        expect(r2.file.value).toBe(original);
    });

    test('keeps a directive nested inside a list item (indentation reconstructed)', async () => {
        // `fixtures/vacations/vacations.md` has `@@inject: parts/prices.md`
        // indented two spaces inside a `- Prices` list item. The whole span
        // between the directives is replaced, prefix included, so the
        // fragment's later lines must have that prefix reconstructed or the
        // injected content falls out of the list item.
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { injectOnly: true, cwd: __root__, silent: true });
        const r = await fi.processFile('fixtures/vacations/vacations.md');
        expect(r.hasChanged).toBe(true);

        const written = r.file.value as string;
        const start = written.indexOf('- Prices');
        const end = written.indexOf('# Highlight Destination');
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const section = written.slice(start, end).trimEnd();
        const lines = section.split('\n');
        expect(lines[0]).toBe('- Prices');
        for (const line of lines.slice(1)) {
            // every continuation line stays indented under the list item;
            // a blank line is allowed to be indentation-only.
            expect(line === '  ' || line.startsWith('  ')).toBe(true);
        }
        expect(section).toContain('  <!--- @@inject: parts/prices.md --->');
        expect(section).toContain('  ## Data');
        expect(section).toContain('  <!--- @@inject-end: parts/prices.md --->');
    });

    test('preserves CRLF line endings for a nested-list-item directive', async () => {
        const vacationsUrl = pathToFileURL(path.join(__root__, 'fixtures/vacations/vacations.md'));
        const crlfSource = (await appFsa.readFile(vacationsUrl, 'utf8')).replace(/\r?\n/g, '\r\n');

        const fsa = createFSA();
        fsa.store.set(vacationsUrl, crlfSource);
        const fi = new FileInjector(fsa, { injectOnly: true, cwd: __root__, silent: true });
        const r = await fi.processFile('fixtures/vacations/vacations.md');
        expect(r.hasChanged).toBe(true);

        const written = r.file.value as string;
        expect(written).not.toMatch(/(?<!\r)\n/); // no bare LF
        expect(written).not.toMatch(/\r(?!\n)/); // no stray CR
        expect(written).toContain('- Prices\r\n  <!--- @@inject: parts/prices.md --->\r\n  \r\n  ## Data\r\n');
    });
});

describe('injection root boundary', () => {
    const boundaryRoot = path.join(__root__, 'fixtures/injection-root-boundary/root');

    test('injects a file inside the injection root', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('local.md');
        expect(r.hasErrors).toBe(false);
        expect(r.file.value).toContain('Inside content.');
    });

    test('rejects a "../" reference that escapes the injection root', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('escape.md');
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain('Failed to read "../outside/secret.md"');
        expect(r.file.value).not.toContain('TOP SECRET');
    });

    test('rejects a symlink inside the root that resolves outside it', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('symlink-escape.md');
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain('Failed to read "link-to-outside/secret.md"');
        expect(r.file.value).not.toContain('TOP SECRET');
    });

    test('allowOutsideRoot permits a listed outside directory', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: boundaryRoot,
            silent: true,
            allowOutsideRoot: [path.join(__root__, 'fixtures/injection-root-boundary/outside')],
        });
        const r = await fi.processFile('escape.md');
        expect(r.hasErrors).toBe(false);
        expect(r.file.value).toContain('TOP SECRET');
    });

    test('an unresolvable allowOutsideRoot entry is dropped, not fatal to in-root reads', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: boundaryRoot,
            silent: true,
            allowOutsideRoot: [path.join(__root__, 'fixtures/injection-root-boundary/does-not-exist')],
        });
        const r = await fi.processFile('local.md');
        expect(r.hasErrors).toBe(false);
        expect(r.file.value).toContain('Inside content.');
    });
});

describe('template variables', () => {
    const valuesRoot = path.join(__root__, 'fixtures/template-variables/values');
    const cliRoot = path.join(__root__, 'fixtures/template-variables/cli-sources');
    const strictRoot = path.join(__root__, 'fixtures/template-variables/strict-vars');
    const boundaryRoot = path.join(__root__, 'fixtures/injection-root-boundary/root');

    function count(text: string, needle: string): number {
        return text.split(needle).length - 1;
    }

    test('directive-level values=/values-file= sources, precedence, escaping, opt-out, and unresolved handling', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: valuesRoot, silent: true });
        const r = await fi.processFile('README.md');
        const written = r.file.value as string;

        // Inline `values=`, auto-derived prefix, explicit prefix, and root merge all resolve `version` to "1.2.3".
        expect(count(written, 'npm install pkg@1.2.3')).toBe(4);
        // Inline `values=` takes precedence over `values-file=` on the same directive.
        expect(count(written, 'npm install pkg@9.9.9')).toBe(1);
        // Not opted in (no `values=`/`values-file=`/`vars`) and a non-scalar values-file lookup both
        // leave the placeholder untouched, literally.
        expect(count(written, 'npm install pkg@{@ version @}')).toBe(2);
        // A backslash-escaped placeholder is unescaped to literal text, not substituted.
        expect(written).toContain('Literal: {@ version @}');
        // Opted in via bare `#vars`, but no source defines the name.
        expect(written).toContain('Value: {@ missing @}');
        // Markdown-tree substitution: prose, inline code, and a fenced code block.
        expect(written).toContain('This release is version 2.0.0.');
        expect(written).toContain('npm install pkg@2.0.0');
        expect(written).toContain("console.log('2.0.0');");

        expect(r.hasErrors).toBe(false);
        expect(r.hasMessages).toBe(true);
        const messages = r.file.messages.map(String).join('\n');
        expect(messages).toContain('Unresolved placeholder "{@ missing @}"');
        expect(messages).toContain('Unresolved placeholder "{@ version @}"');
    });

    test('CLI --value/--values-file/--allow-env, and directive values= takes precedence over --value', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: cliRoot,
            silent: true,
            value: { fromCli: 'CliValue', greeting: 'CLI' },
            valuesFile: ['cliData.json'],
            allowEnv: ['TV_TEST_VAR'],
        });
        const previousEnv = process.env.TV_TEST_VAR;
        process.env.TV_TEST_VAR = 'envValue';
        try {
            const r = await fi.processFile('README.md');
            expect(r.hasErrors).toBe(false);
            const written = r.file.value as string;
            expect(written).toContain('Value: CliValue');
            expect(written).toContain('Town: Springfield');
            expect(written).toContain('Env: envValue');
            expect(written).toContain('Greeting: Directive');
        } finally {
            if (previousEnv === undefined) delete process.env.TV_TEST_VAR;
            else process.env.TV_TEST_VAR = previousEnv;
        }
    });

    test('without --allow-env, an env. reference is unresolved', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: cliRoot, silent: true });
        const r = await fi.processFile('README.md');
        expect(r.file.value).toContain('Env: {@ env.TV_TEST_VAR @}');
    });

    test('--strict-vars turns an unresolved placeholder into a directive error', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: strictRoot, silent: true, strictVars: true });
        const r = await fi.processFile('README.md');
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain('Unresolved placeholder "{@ missing @}"');
    });

    test('without --strict-vars, an unresolved placeholder is a warning, not an error', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: strictRoot, silent: true });
        const r = await fi.processFile('README.md');
        expect(r.hasErrors).toBe(false);
        expect(r.hasMessages).toBe(true);
    });

    test('an unreadable --values-file raises an OptionError, not a document error', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: valuesRoot, silent: true, valuesFile: ['does-not-exist.json'] });
        await expect(fi.processFile('README.md')).rejects.toThrow(OptionError);
        await expect(fi.processFile('README.md')).rejects.toThrow('Failed to read values file');
    });

    test('a table value containing the delimiter stays in its own cell', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: path.join(__root__, 'fixtures/template-variables/table'),
            silent: true,
        });
        const r = await fi.processFile('README.md');
        const written = r.file.value as string;
        // Substitution runs per parsed cell (ADR-0006 point 3), so `1,2` must not add a column.
        expect(written).toContain('| pkg   | 1,2           |');
        expect(written).not.toContain('| 1     | 2 |');
        // An unresolved placeholder in a cell is left as written.
        expect(written).toContain('{@ missing @}');
    });

    test('a directive values-file= reference outside the injection root is blocked', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('values-file-escape.md');
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain('Outside the injection root');
        expect(r.file.value).not.toContain('TOP SECRET');
    });
});

function normalizeWriteFileCalls(
    writeFile: MockedFileSystemAdapter['writeFile'],
): MockedFileSystemAdapter['writeFile']['mock']['calls'] {
    const calls = writeFile.mock.calls;
    const cwd = pathToFileURL('.');
    const normalized = calls.map(
        ([pathLike, data, encoding]) =>
            [relativePath(cwd, normalizePath(pathLike)).toString(), data, encoding] as Parameters<
                FileSystemAdapter['writeFile']
            >,
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
        realpath: vi.fn().mockImplementation((p: PathLike) => appFsa.realpath(p)),
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

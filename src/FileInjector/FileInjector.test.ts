import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as path from 'path';
import { format } from 'util';
import { describe, expect, type MockedFunction, test, vi } from 'vitest';

import type { BufferEncoding, FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import { nodeFsa } from '../FileSystemAdapter/fsa.js';
import { createStore, normalizePath, type Store } from '../FileSystemAdapter/fsStore.mjs';
import { OptionError } from '../util/errors.js';
import { isURL, relativePath } from '../util/url_helper.js';
import { FileInjector, type Logger } from './FileInjector.js';

const __file__ = fileURLToPath(import.meta.url);
const __dirname__ = path.dirname(__file__);
const __root__ = path.join(__dirname__, '../..');

const appFsa = nodeFsa();

/**
 * Canned bodies for the remote references the fixtures contain, so the suite never makes a live
 * request — a network hiccup would otherwise fail an unrelated assertion in an unrelated test.
 * Keyed by the reference exactly as written: `normalizePath` percent-encodes a remote URL's `#`
 * into the key rather than stripping it, so the fragment is part of the identity.
 */
const remoteResponses: Record<string, string> = {
    'https://github.com/streetsidesoftware/inject-markdown/blob/d7de2f5fe/src/app.mts#L15-L19': readFileSync(
        path.join(__root__, 'fixtures/remote-responses/inject-markdown-d7de2f5fe-app.mts.txt'),
        'utf8',
    ),
};

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
        expect(r.file.messages.map(String).join('\n')).toContain(
            'Access denied: "../outside/secret.md" is outside the injection root',
        );
        expect(r.file.value).not.toContain('TOP SECRET');
    });

    test('rejects a symlink inside the root that resolves outside it', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('symlink-escape.md');
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain(
            'Access denied: "link-to-outside/secret.md" is outside the injection root',
        );
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

    test('rejects an out-of-root markdown reference as a fatal error', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('escape-markdown.md');
        // Fatal, unlike a merely missing markdown file, so `--stop-on-errors` applies.
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain(
            'Access denied: "../outside/secret.md" is outside the injection root',
        );
        expect(r.file.value).not.toContain('TOP SECRET');
    });

    test('denies an out-of-root reference identically whether or not it exists', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('escape-missing.md');
        // Same severity and wording as the existing-file case, so the denial says nothing about
        // which paths are present on the machine running the tool.
        expect(r.hasErrors).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain(
            'Access denied: "../outside/does-not-exist.md" is outside the injection root',
        );
    });

    test('a missing in-root markdown reference stays a warning', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('missing-inside.md');
        expect(r.hasErrors).toBe(false);
        expect(r.hasMessages).toBe(true);
        expect(r.file.messages.map(String).join('\n')).toContain('Failed to read "does-not-exist.md"');
    });

    test('reads the symlink-resolved path the boundary check approved', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: boundaryRoot, silent: true });
        const r = await fi.processFile('symlink-inside.md');
        expect(r.hasErrors).toBe(false);
        expect(r.file.value).toContain('Inside content.');
        // The read must target the realpath, not the symlink that was checked.
        const readPaths = fsa.readFile.mock.calls.map(([p]) => fileURLToPath(p as URL));
        expect(readPaths).toContain(path.join(boundaryRoot, 'inside.md'));
        expect(readPaths).not.toContain(path.join(boundaryRoot, 'link-to-inside.md'));
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
    const layersRoot = path.join(__root__, 'fixtures/template-variables/layers');
    const aliasRoot = path.join(__root__, 'fixtures/template-variables/alias');

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

    test('layers union per leaf: prefixed and root-merged values-file entries (ADR-0008)', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: layersRoot, silent: true });
        const r = await fi.processFile('README.md');
        const written = r.file.value as string;
        // Last-listed wins on the shared name, but the earlier entry's own names survive —
        // including a nested branch both files define.
        expect(written).toContain('v=fromB a=A b=B deepA=yes deepB=yes');
        expect(written).toContain('v=fromB a=A b=B deepA=yes');
        // A branch, an array and a null are all unresolved, each naming its kind.
        const messages = r.file.messages.map(String).join('\n');
        expect(messages).toContain('"{@ branch.engines @}": resolves to an object, not a value');
        expect(messages).toContain('"{@ branch.list @}": resolves to an array, not a value');
        expect(messages).toContain('"{@ branch.nulled @}": resolves to null, not a value');
        expect(messages).toContain('"{@ missingName @}": no value source defines it');
        expect(r.hasErrors).toBe(false);
    });

    test('--value keeps both names when one is a prefix of another', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: layersRoot,
            silent: true,
            value: { a: '1', 'a.b': '2' },
        });
        const r = await fi.processFile('cli-nested.md');
        // One folded tree would lose `a` to `a.b`; one layer per flag keeps both.
        expect(r.file.value).toContain('a=1 ab=2');
        expect(r.hasErrors).toBe(false);
    });

    test('a non-scalar in a higher-precedence source falls through to a lower one', async () => {
        const fsa = createFSA();
        // The directive's `values=x.y:...` creates an object at `x` as a side effect of the dotted
        // name. The lower-precedence CLI `--value x=...` scalar must still resolve `{@ x @}`.
        const fi = new FileInjector(fsa, { cwd: layersRoot, silent: true, value: { x: 'fromCli' } });
        const r = await fi.processFile('fallthrough.md');
        expect(r.file.value).toContain('x=fromCli xy=fromDirective');
        expect(r.hasErrors).toBe(false);
    });

    test('a repeated hash key accumulates, matching the comma list (ADR-0011)', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: aliasRoot, silent: true });
        // Same directive as README.md's first section, spelled with `values-file=` repeated
        // instead of comma-separated. Before ADR-0011 the first entry was dropped silently,
        // so `name` — which only package.json supplies — was unresolved.
        const r = await fi.processFile('repeated.md');
        expect(r.file.value).toContain('name=demo version=2.5.0 date=2026-09-22');
        expect(r.hasErrors).toBe(false);
        expect(r.hasMessages).toBe(false);
    });

    test('value-alias= redefines, chains, detects cycles and names both sides (ADR-0010)', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, { cwd: aliasRoot, silent: true });
        const r = await fi.processFile('README.md');
        const written = r.file.value as string;
        // The alias outranks its own tier's values: `version` comes from releases.json, not from
        // the root-merged package.json, while `name` still does.
        expect(written).toContain('name=demo version=2.5.0 date=2026-09-22');
        // a -> b -> release.latest.version
        expect(written).toContain('a=2.5.0');
        const messages = r.file.messages.map(String).join('\n');
        expect(messages).toContain('"{@ loop @}": alias cycle through "round"');
        expect(messages).toContain('"{@ gone @}": aliased to "no.such.name": no value source defines it');
        expect(r.hasErrors).toBe(false);
    });

    test('a directive alias outranks a CLI alias, and a CLI alias outranks --value', async () => {
        const fsa = createFSA();
        const fi = new FileInjector(fsa, {
            cwd: aliasRoot,
            silent: true,
            valueAlias: { version: 'name' },
            value: { version: 'fromCliValue' },
        });
        const r = await fi.processFile('README.md');
        // The directive's own alias wins over the CLI alias and over --value.
        expect(r.file.value).toContain('version=2.5.0');
    });

    test('an alias may target the reserved env. namespace, still gated by --allow-env', async () => {
        const fsa = createFSA();
        const previous = process.env.TV_ALIAS_VAR;
        process.env.TV_ALIAS_VAR = 'fromEnv';
        try {
            const allowed = new FileInjector(fsa, {
                cwd: aliasRoot,
                silent: true,
                valueAlias: { token: 'env.TV_ALIAS_VAR' },
                allowEnv: ['TV_ALIAS_VAR'],
            });
            expect((await allowed.processFile('README.md')).file.value).toContain('token=fromEnv');

            const denied = new FileInjector(fsa, {
                cwd: aliasRoot,
                silent: true,
                valueAlias: { token: 'env.TV_ALIAS_VAR' },
            });
            // Without --allow-env the alias resolves through the namespace and finds nothing.
            expect((await denied.processFile('README.md')).file.value).toContain('token={@ token @}');
        } finally {
            if (previous === undefined) delete process.env.TV_ALIAS_VAR;
            else process.env.TV_ALIAS_VAR = previous;
        }
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
        expect(r.file.messages.map(String).join('\n')).toContain('is outside the injection root');
        expect(r.file.value).not.toContain('TOP SECRET');
    });
});

describe('#markdown table cells (ADR-0008)', () => {
    async function processTables() {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const r = await fi.processFile('README.md');
        return r.file.value as string;
    }

    test('renders inline Markdown, keeps block syntax literal, and escapes pipes', async () => {
        const written = await processTables();
        expect(written).toContain('| **`columns`** | Pick columns, e.g. `a\\|b` or a \\| b');
        expect(written).toContain('| # Title       | - item stays literal');
        expect(written).toContain('| <sup>1</sup>  | line one<br />line two');
    });

    test('substitutes placeholders before parsing, so a value can carry Markdown', async () => {
        const written = await processTables();
        // Parsed as emphasis, then written in the document's detected emphasis style.
        expect(written).toContain('| plain         | has _draft_');
    });

    test('without #markdown the same cells stay escaped', async () => {
        const written = await processTables();
        expect(written).toContain('| \\*\\*\\`columns\\`\\*\\* |');
    });
});

describe('#html-table (ADR-0010)', () => {
    async function processTables() {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const r = await fi.processFile('README.md');
        return r.file.value as string;
    }

    test('emits an HTML table with compact plain cells and wrapped Markdown cells', async () => {
        const written = await processTables();
        expect(written).toContain('<td>a &lt; b &amp; c</td>');
        expect(written).toContain('<td>\n\n**new**\n\n- a\n- b\n\n</td>');
    });

    test('wins over #markdown when both are given', async () => {
        const written = await processTables();
        const start = written.indexOf('<!--- @@inject: markdown.csv#markdown&html-table --->');
        const end = written.indexOf('<!--- @@inject-end: markdown.csv#markdown&html-table --->');
        const section = written.slice(start, end);
        expect(section).toContain('<table>');
        expect(section).not.toContain('| Option');
    });
});

describe('row window (ADR-0004)', () => {
    test('windows data rows and keeps the header', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const written = (await fi.processFile('README.md')).file.value as string;
        const section = (hash: string) =>
            written.slice(
                written.indexOf(`<!--- @@inject: rows.csv#${hash} --->`),
                written.indexOf(`<!--- @@inject-end: rows.csv#${hash} --->`),
            );
        expect(section('start-row=2&num-rows=2')).toMatch(/\| 2 +\| two +\|\n\| 3 +\| three +\|\n\n$/);
        expect(section('end-row=2')).toMatch(/\| 1 +\| one +\|\n\| 2 +\| two +\|\n\n$/);
        const empty = section('start-row=100');
        expect(empty).toContain('| n | name |');
        expect(empty).not.toContain('one');
    });

    test('header rows are kept and the window counts data rows after them', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const written = (await fi.processFile('README.md')).file.value as string;
        expect(written).toContain('| Date       | Name<br />First | Name<br />Last | Value |');
        const windowed = written.slice(written.indexOf('grouped.csv#header-rows=2&start-row=2 --->'));
        expect(windowed.slice(0, windowed.indexOf('inject-end'))).not.toContain('Ada');
    });

    test('a file shorter than header-rows is all header and no data', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const r = await fi.processFile('README.md');
        expect(r.hasErrors).toBe(false);
        const written = r.file.value as string;
        const start = written.indexOf('<!--- @@inject: grouped.csv#header-rows=9 --->');
        const section = written.slice(start, written.indexOf('<!--- @@inject-end: grouped.csv#header-rows=9', start));
        expect(section).toContain('Date<br />2024-01-01<br />2024-01-02');
        expect(
            section
                .trim()
                .split('\n')
                .filter((l) => l.startsWith('|')),
        ).toHaveLength(2);
    });

    test('header-rows=0 with a window past the end keeps the numbered header', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const written = (await fi.processFile('README.md')).file.value as string;
        const start = written.indexOf('<!--- @@inject: rows.csv#header-rows=0&start-row=100 --->');
        const section = written.slice(start, written.indexOf('<!--- @@inject-end', start));
        expect(section).toContain('| 1 | 2 |');
    });

    test('an invalid window value is a directive error', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/with-errors'), silent: true });
        const r = await fi.processFile('table-row-window.md');
        expect(r.hasErrors).toBe(true);
        const messages = r.file.messages.map(String).join('\n');
        expect(messages).toContain('Invalid start-row "abc": expected a whole number.');
        expect(messages).toContain('Invalid start-row "0": row numbers start at 1.');
        expect(messages).toContain('Invalid num-rows "-1": expected a whole number.');
    });
});

describe('JSON table source (ADR-0011)', () => {
    test('renders each table form, windowed columns, and substituted nested strings', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const written = (await fi.processFile('README.md')).file.value as string;
        expect(written).toContain('| Ada   | 1815 | \\["math","poetry"] | {"v":"1.0"} |');
        expect(written).toContain('| Ada   | 1815 | `["math","poetry"]` | `{"v":"1.0"}` |');
        expect(written).toContain('<td>\n\n```json\n{\n  "v": "1.0"\n}\n```\n\n</td>');
        expect(written).toContain('| name  | role            | active | note |');
        expect(written).toContain('| name | born | tags | meta | role | active | note |');
        // header-rows=0 drops the key header, so the pipe form numbers the columns (ADR-0011 point 9).
        expect(written).toContain('| 1     | 2    | 3                  | 4                     |');
    });

    test('bad JSON sources are directive errors', async () => {
        const fi = new FileInjector(createFSA(), {
            cwd: path.join(__root__, 'fixtures/with-errors/json-table'),
            silent: true,
        });
        const r = await fi.processFile('README.md');
        expect(r.hasErrors).toBe(true);
        const messages = r.file.messages.map(String).join('\n');
        expect(messages).toContain('Invalid JSON: ');
        expect(messages).toContain('Expected a JSON array of objects, found an object.');
        expect(messages).toContain('Expected a JSON array of objects, but element 2 is a number.');
        expect(messages).toContain('Expected a JSON array of objects, found an empty array.');
        expect(messages).toContain('A line range can not be used on a JSON table');
        expect(messages).toContain('header-rows=2 can not be used on a JSON table');
    });

    test('header-rows=0 with an empty window keeps one numbered column per key', async () => {
        const fi = new FileInjector(createFSA(), { cwd: path.join(__root__, 'fixtures/tables'), silent: true });
        const written = (await fi.processFile('README.md')).file.value as string;
        const start = written.indexOf('<!--- @@inject-table: people.json#header-rows=0&start-row=100 --->');
        const section = written.slice(start, written.indexOf('<!--- @@inject-end', start));
        expect(section).toContain('| 1 | 2 | 3 | 4 | 5 | 6 | 7 |');
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
    for (const [ref, body] of Object.entries(remoteResponses)) {
        store.set(ref, body);
    }

    async function readFile(p: PathLike, e: BufferEncoding): Promise<string> {
        const found = store.get(p);
        if (typeof found === 'string') return found;
        assertNotRemote(p);
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

/**
 * The suite is offline by design. A remote reference has to be seeded in `remoteResponses`;
 * reaching the network instead makes the run depend on github.com being up and on the response
 * still matching the snapshots. `resolveAndReadFile` rewrites every read failure to
 * `Failed to read`, so the reason is logged as well as thrown — otherwise a newly added remote
 * fixture fails an assertion with nothing pointing at the cause.
 */
function assertNotRemote(p: PathLike): void {
    if (!isURL(p) || p.protocol === 'file:') return;
    const message = `Refusing to fetch "${p.href}" from a test. Add it to \`remoteResponses\`.`;
    console.error(message);
    throw new Error(message);
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

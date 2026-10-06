import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { injectFile, injectMarkdown, type ValueDeclaration } from './api.mjs';
import * as index from './index.mjs';
import { OptionError } from './util/errors.js';

const csv = 'name,value\na,1\n';
const readme = '# Samples\n\n<!--- @@inject: sample-sources.csv --->\n';

describe('api', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), 'inject-markdown-api-'));
        await writeFile(path.join(dir, 'sample-sources.csv'), csv);
        await writeFile(path.join(dir, 'README.md'), readme);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(dir, { recursive: true, force: true });
    });

    const read = (file: string) => readFile(path.join(dir, file), 'utf8');

    test('index exports', () => {
        expect(Object.keys(index).sort()).toEqual([
            'OptionError',
            'app',
            'injectFile',
            'injectMarkdown',
            'removeDirectives',
            'run',
        ]);
    });

    describe('injectFile', () => {
        test('injects and writes the file, then finds it up to date', async () => {
            const result = await injectFile('README.md', { cwd: dir });
            expect(result).toEqual({ updated: true, written: true, errors: [], warnings: [] });
            const content = await read('README.md');
            expect(content).toContain('| name | value |');
            expect(content).toContain('<!--- @@inject-end: sample-sources.csv --->');

            const again = await injectFile('README.md', { cwd: dir });
            expect(again).toEqual({ updated: false, written: false, errors: [], warnings: [] });
            expect(await read('README.md')).toBe(content);
        });

        test('prints nothing', async () => {
            const stderr = vi.spyOn(process.stderr, 'write');
            const stdout = vi.spyOn(process.stdout, 'write');
            const error = vi.spyOn(console, 'error');
            await writeFile(path.join(dir, 'broken.md'), '<!--- @@inject: missing.ts --->\n');
            await injectFile('README.md', { cwd: dir });
            await injectFile('broken.md', { cwd: dir });
            expect(stderr).not.toHaveBeenCalled();
            expect(stdout).not.toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });

        test('accepts a URL cwd', async () => {
            const result = await injectFile('README.md', { cwd: pathToFileURL(dir + '/') });
            expect(result.updated).toBe(true);
        });

        test('returns errors and does not write the file', async () => {
            const md = 'Text\n\n<!--- @@inject: missing.ts --->\n';
            await writeFile(path.join(dir, 'README.md'), md);
            const result = await injectFile('README.md', { cwd: dir });
            expect(result).toEqual(
                expect.objectContaining({
                    written: false,
                    errors: [expect.objectContaining({ line: 3, message: expect.stringContaining('missing.ts') })],
                }),
            );
            expect(await read('README.md')).toBe(md);
        });

        test('returns warnings', async () => {
            await writeFile(path.join(dir, 'README.md'), '<!--- @@inject: missing.md --->\n');
            const result = await injectFile('README.md', { cwd: dir });
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([expect.objectContaining({ message: 'Failed to read "missing.md"' })]);
        });

        test('throws the read error for a missing file', async () => {
            await expect(injectFile('missing.md', { cwd: dir })).rejects.toThrow('ENOENT');
        });

        test('clean', async () => {
            await injectFile('README.md', { cwd: dir });
            await injectFile('README.md', { cwd: dir, clean: true });
            expect(await read('README.md')).not.toContain('| name | value |');
        });
    });

    describe('injectMarkdown', () => {
        test('resolves references from file and writes nothing', async () => {
            await mkdir(path.join(dir, 'samples'));
            await writeFile(path.join(dir, 'samples/sample-sources.csv'), csv);
            const result = await injectMarkdown(readme, { cwd: dir, file: 'samples/README.md' });
            expect(result.updated).toBe(true);
            expect(result.markdown).toContain('| name | value |');
            expect(result.markdown.startsWith('# Samples\n\n<!--- @@inject: sample-sources.csv --->\n')).toBe(true);
            expect(await read('README.md')).toBe(readme);
        });

        test('returns Markdown without directives unchanged', async () => {
            const md = '# Title\n\n* item\n';
            const result = await injectMarkdown(md, { cwd: dir, file: 'README.md' });
            expect(result).toEqual({ markdown: md, updated: false, errors: [], warnings: [] });
        });

        test.each`
            rebaseLinks  | expected
            ${undefined} | ${'[up](up.md)'}
            ${false}     | ${'[up](../up.md)'}
        `('rebaseLinks: $rebaseLinks', async ({ rebaseLinks, expected }) => {
            await mkdir(path.join(dir, 'parts'));
            await writeFile(path.join(dir, 'parts/links.md'), '[up](../up.md)\n');
            const md = '<!--- @@inject: parts/links.md --->\n';
            const result = await injectMarkdown(md, { cwd: dir, file: 'README.md', rebaseLinks });
            expect(result.markdown).toContain(expected);
        });

        describe('values', () => {
            const md = '<!--- @@inject: show.md#vars --->\n';
            const inject = async (values: ValueDeclaration[]) => {
                const result = await injectMarkdown(md, { cwd: dir, file: 'README.md', valueDeclarations: values });
                return result.markdown;
            };

            beforeEach(async () => {
                await writeFile(path.join(dir, 'show.md'), 'Value: {@ shown @}\n');
                await writeFile(path.join(dir, 'data.json'), JSON.stringify({ town: 'Springfield', shown: 'root' }));
            });

            test.each`
                values                                                                                                                                                               | expected
                ${[{ kind: 'value', name: 'shown', value: 'v' }]}                                                                                                                    | ${'Value: v'}
                ${[{ kind: 'value', name: 'shown', value: 'v' }, { kind: 'values-file', path: 'data.json', prefix: 'data' }, { kind: 'alias', name: 'shown', target: 'data.town' }]} | ${'Value: Springfield'}
                ${[{ kind: 'alias', name: 'shown', target: 'data.town' }, { kind: 'values-file', path: 'data.json', prefix: 'data' }, { kind: 'value', name: 'shown', value: 'v' }]} | ${'Value: v'}
                ${[{ kind: 'value', name: 'shown', value: 'old' }, { kind: 'alias', name: 'shown', target: 'data.town' }, { kind: 'value', name: 'shown', value: 'new' }]}           | ${'Value: new'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: '' }]}                                                                                                          | ${'Value: root'}
                ${[{ kind: 'value', name: 'shown', value: 'v' }, { kind: 'values-file', path: 'data.json', prefix: '' }]}                                                            | ${'Value: root'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: '' }, { kind: 'value', name: 'shown', value: 'v' }]}                                                            | ${'Value: v'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: 'my.data' }, { kind: 'alias', name: 'shown', target: 'my.data.town' }]}                                         | ${'Value: Springfield'}
            `('newest declaration wins: $values', async ({ values, expected }) => {
                expect(await inject(values)).toContain(expected);
            });

            test('throws an exported OptionError for invalid options', async () => {
                const p = inject([{ kind: 'values-file', path: 'data.json', prefix: 'a b' }]);
                await expect(p).rejects.toBeInstanceOf(index.OptionError);
                await expect(p).rejects.toBeInstanceOf(OptionError);
            });

            test('rejects an invalid prefix before reading anything', async () => {
                await expect(inject([{ kind: 'values-file', path: 'missing.json', prefix: 'a b' }])).rejects.toThrow(
                    'Invalid prefix "a b" for values file "missing.json".',
                );
            });

            test('accepts a one-character prefix', async () => {
                const values: ValueDeclaration[] = [
                    { kind: 'values-file', path: 'data.json', prefix: 'x' },
                    { kind: 'alias', name: 'shown', target: 'x.town' },
                ];
                expect(await inject(values)).toContain('Value: Springfield');
            });
        });

        test('returns injection errors instead of throwing', async () => {
            const md = '<!--- @@inject: missing.ts --->\n';
            const result = await injectMarkdown(md, { cwd: dir, file: 'README.md' });
            expect(result.errors).toEqual([
                expect.objectContaining({ line: 1, message: expect.stringContaining('missing.ts') }),
            ]);
        });
    });
});

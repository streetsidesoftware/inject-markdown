import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { injectFiles, injectMarkdown, InjectMarkdownError, type ValueDeclaration } from './api.mjs';
import * as index from './index.mjs';

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
            'InjectMarkdownError',
            'app',
            'injectFiles',
            'injectMarkdown',
            'run',
        ]);
    });

    describe('injectFiles', () => {
        test('injects and writes the file, then finds it up to date', async () => {
            const result = await injectFiles(['README.md'], { cwd: dir });
            expect(result).toEqual({
                filesFound: 1,
                filesProcessed: 1,
                filesWithInjections: 1,
                filesUpdated: 1,
                filesWritten: 1,
                filesSkipped: 0,
                errors: [],
                warnings: [],
            });
            const content = await read('README.md');
            expect(content).toContain('| name | value |');
            expect(content).toContain('<!--- @@inject-end: sample-sources.csv --->');

            const again = await injectFiles(['README.md'], { cwd: dir });
            expect(again).toEqual(expect.objectContaining({ filesUpdated: 0, filesWritten: 0 }));
            expect(await read('README.md')).toBe(content);
        });

        test('prints nothing and leaves the process cwd alone', async () => {
            const stderr = vi.spyOn(process.stderr, 'write');
            const stdout = vi.spyOn(process.stdout, 'write');
            const error = vi.spyOn(console, 'error');
            const cwd = process.cwd();
            await writeFile(path.join(dir, 'broken.md'), '<!--- @@inject: missing.ts --->\n');
            await injectFiles(['*.md'], { cwd: dir, stopOnErrors: false });
            expect(stderr).not.toHaveBeenCalled();
            expect(stdout).not.toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
            expect(process.cwd()).toBe(cwd);
        });

        test('accepts a URL cwd', async () => {
            const result = await injectFiles(['README.md'], { cwd: pathToFileURL(dir + '/'), dryRun: true });
            expect(result).toEqual(expect.objectContaining({ filesFound: 1, filesUpdated: 1 }));
        });

        test('dryRun reports the update without writing', async () => {
            const result = await injectFiles(['README.md'], { cwd: dir, dryRun: true });
            expect(result).toEqual(expect.objectContaining({ filesUpdated: 1, filesWritten: 0, filesSkipped: 1 }));
            expect(await read('README.md')).toBe(readme);
        });

        test('returns errors instead of throwing or exiting', async () => {
            await writeFile(path.join(dir, 'README.md'), 'Text\n\n<!--- @@inject: missing.ts --->\n');
            const result = await injectFiles(['README.md'], { cwd: dir });
            expect(result.filesWritten).toBe(0);
            expect(result.filesSkipped).toBe(1);
            expect(result.errors).toEqual([
                expect.objectContaining({ file: 'README.md', line: 3, message: expect.stringContaining('missing.ts') }),
            ]);
        });

        test('returns warnings', async () => {
            await writeFile(path.join(dir, 'README.md'), '<!--- @@inject: missing.md --->\n');
            const result = await injectFiles(['README.md'], { cwd: dir });
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([
                expect.objectContaining({ file: 'README.md', message: 'Failed to read "missing.md"' }),
            ]);
        });

        test('stopOnErrors', async () => {
            await mkdir(path.join(dir, 'docs'));
            await writeFile(path.join(dir, 'docs/a.md'), '<!--- @@inject: missing.ts --->\n');
            await writeFile(path.join(dir, 'docs/b.md'), '<!--- @@inject: missing.ts --->\n');
            const stopped = await injectFiles(['docs/*.md'], { cwd: dir });
            expect(stopped.filesProcessed).toBe(1);
            const all = await injectFiles(['docs/*.md'], { cwd: dir, stopOnErrors: false });
            expect(all.filesProcessed).toBe(2);
            expect(all.errors.map((e) => e.file)).toEqual(['docs/a.md', 'docs/b.md']);
        });

        test('mustFindFiles', async () => {
            await expect(injectFiles(['*.txt'], { cwd: dir })).rejects.toBeInstanceOf(InjectMarkdownError);
            const result = await injectFiles(['*.txt'], { cwd: dir, mustFindFiles: false });
            expect(result.filesFound).toBe(0);
        });

        test('outputDir', async () => {
            const result = await injectFiles(['README.md'], { cwd: dir, outputDir: path.join(dir, 'out') });
            expect(result.filesWritten).toBe(1);
            expect(await read('README.md')).toBe(readme);
            expect(await read('out/README.md')).toContain('| name | value |');
        });

        test('clean', async () => {
            await injectFiles(['README.md'], { cwd: dir });
            await injectFiles(['README.md'], { cwd: dir, clean: true });
            expect(await read('README.md')).not.toContain('| name | value |');
        });
    });

    describe('injectMarkdown', () => {
        test('resolves references from file and writes nothing', async () => {
            await mkdir(path.join(dir, 'samples'));
            await writeFile(path.join(dir, 'samples/sample-sources.csv'), csv);
            const result = await injectMarkdown(readme, { cwd: dir, file: 'samples/README.md' });
            expect(result).toContain('| name | value |');
            expect(result.startsWith('# Samples\n\n<!--- @@inject: sample-sources.csv --->\n')).toBe(true);
            expect(await read('README.md')).toBe(readme);
        });

        test('returns Markdown without directives unchanged', async () => {
            const md = '# Title\n\n* item\n';
            expect(await injectMarkdown(md, { cwd: dir, file: 'README.md' })).toBe(md);
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
            expect(result).toContain(expected);
        });

        describe('values', () => {
            const md = '<!--- @@inject: show.md#vars --->\n';
            const inject = (values: ValueDeclaration[]) =>
                injectMarkdown(md, { cwd: dir, file: 'README.md', valueDeclarations: values });

            beforeEach(async () => {
                await writeFile(path.join(dir, 'show.md'), 'Value: {@ shown @}\n');
                await writeFile(path.join(dir, 'data.json'), JSON.stringify({ town: 'Springfield', shown: 'root' }));
            });

            test.each`
                values                                                                                                                                                     | expected
                ${[{ kind: 'value', name: 'shown', value: 'v' }]}                                                                                                          | ${'Value: v'}
                ${[{ kind: 'value', name: 'shown', value: 'v' }, { kind: 'values-file', path: 'data.json' }, { kind: 'alias', name: 'shown', target: 'data.town' }]}       | ${'Value: Springfield'}
                ${[{ kind: 'alias', name: 'shown', target: 'data.town' }, { kind: 'values-file', path: 'data.json' }, { kind: 'value', name: 'shown', value: 'v' }]}       | ${'Value: v'}
                ${[{ kind: 'value', name: 'shown', value: 'old' }, { kind: 'alias', name: 'shown', target: 'data.town' }, { kind: 'value', name: 'shown', value: 'new' }]} | ${'Value: new'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: '' }]}                                                                                                | ${'Value: root'}
                ${[{ kind: 'value', name: 'shown', value: 'v' }, { kind: 'values-file', path: 'data.json', prefix: '' }]}                                                  | ${'Value: root'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: '' }, { kind: 'value', name: 'shown', value: 'v' }]}                                                  | ${'Value: v'}
                ${[{ kind: 'values-file', path: 'data.json', prefix: 'my.data' }, { kind: 'alias', name: 'shown', target: 'my.data.town' }]}                               | ${'Value: Springfield'}
            `('newest declaration wins: $values', async ({ values, expected }) => {
                expect(await inject(values)).toContain(expected);
            });

            test('rejects an invalid prefix', async () => {
                await expect(inject([{ kind: 'values-file', path: 'data.json', prefix: 'x' }])).rejects.toThrow(
                    'Invalid values-file prefix "x"',
                );
            });
        });

        test('throws on injection errors', async () => {
            const md = '<!--- @@inject: missing.ts --->\n';
            const p = injectMarkdown(md, { cwd: dir, file: 'README.md' });
            await expect(p).rejects.toBeInstanceOf(InjectMarkdownError);
            await expect(p).rejects.toEqual(
                expect.objectContaining({ errors: [expect.objectContaining({ file: 'README.md', line: 1 })] }),
            );
        });
    });
});

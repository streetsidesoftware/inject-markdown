import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { Command, CommanderError } from 'commander';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';

import * as app from './app.mjs';

const __file__ = fileURLToPath(import.meta.url);
const __dirname__ = path.dirname(__file__);
const __root__ = path.join(__dirname__, '..');

describe('app', () => {
    test('compiles', () => {
        expect(Object.keys(app).sort()).toMatchSnapshot();
    });

    test('help', async () => {
        const command = new Command();
        const argv = createArgv('--help');
        command.exitOverride(errorHandler);
        await expect(app.run(command, argv)).rejects.toBeInstanceOf(CommanderError);
    });

    test.each`
        args
        ${'README.md'}
        ${'fixtures/no-injections/*.md'}
        ${['escape.md', '--cwd=fixtures/injection-root-boundary/root', '--allow-outside-root=fixtures/injection-root-boundary/outside']}
    `('run $args', async ({ args }) => {
        const command = new Command();
        const argv = createArgv(args, '--output-dir=temp');
        command.exitOverride(errorHandler);
        await expect(app.run(command, argv)).resolves.toBeUndefined();
    });

    test.each`
        args
        ${'*.json'}
        ${['fixtures/with-errors/*.md', '--no-stop-on-error']}
        ${['fixtures/with-errors/*.md', '--no-stop-on-errors']}
        ${['fixtures/with-errors/*.md', '--color']}
        ${['escape.md', '--cwd=fixtures/injection-root-boundary/root']}
        ${['symlink-escape.md', '--cwd=fixtures/injection-root-boundary/root']}
        ${['escape-markdown.md', '--cwd=fixtures/injection-root-boundary/root']}
        ${['escape-missing.md', '--cwd=fixtures/injection-root-boundary/root']}
    `('run with errors $args', async ({ args }) => {
        const command = new Command();
        const argv = createArgv(args, '--output-dir=temp');
        command.exitOverride(errorHandler);
        await expect(app.run(command, argv)).rejects.toBeInstanceOf(CommanderError);
    });

    test.each`
        order                                                                                        | expected
        ${['--value=fromCli=v', '--values-file=cliData.json', '--value-alias=fromCli=cliData.town']} | ${'Value: Springfield'}
        ${['--value-alias=fromCli=cliData.town', '--values-file=cliData.json', '--value=fromCli=v']} | ${'Value: v'}
        ${['--value=fromCli=old', '--value-alias=fromCli=cliData.town', '--value=fromCli=new']}      | ${'Value: new'}
    `('CLI value flags resolve in command-line order, newest first: $order', async ({ order, expected }) => {
        const outDir = await mkdtemp(path.join(tmpdir(), 'inject-markdown-'));
        try {
            const command = new Command();
            const cwd = path.join(__root__, 'fixtures/template-variables/cli-sources');
            const argv = createArgv('README.md', `--cwd=${cwd}`, `--output-dir=${outDir}`, '--silent', order);
            command.exitOverride(errorHandler);
            await app.run(command, argv);
            expect(await readFile(path.join(outDir, 'README.md'), 'utf8')).toContain(expected);
        } finally {
            await rm(outDir, { recursive: true, force: true });
        }
    });
});

function createArgv(...args: (string | string[])[]): string[] {
    return [process.argv[0], path.join(__root__, 'bin.mjs'), ...flatten(args)];
}

function* flatten<T>(arr: Iterable<T | T[]>): Iterable<T> {
    for (const item of arr) {
        if (Array.isArray(item)) {
            yield* item;
        } else {
            yield item;
        }
    }
}

function errorHandler(err: CommanderError) {
    throw err;
}

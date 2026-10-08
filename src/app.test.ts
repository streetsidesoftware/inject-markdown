import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { Command, CommanderError } from 'commander';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, test, vi } from 'vitest';

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

    describe('help width', () => {
        afterEach(() => {
            vi.unstubAllEnvs(); // cspell:ignore unstub
        });

        test.each`
            columns
            ${'72'}
            ${'60'}
        `('help fits in COLUMNS=$columns', async ({ columns }) => {
            vi.stubEnv('COLUMNS', columns);
            const width = Number(columns);
            const command = new Command();
            let out = '';
            command.configureOutput({ writeOut: (str) => (out += str) });
            command.exitOverride(errorHandler);
            await expect(app.run(command, createArgv('--help'))).rejects.toBeInstanceOf(CommanderError);

            expect(out).toContain('Usage: inject-markdown');
            expect(out.split('\n').filter((line) => line.length > width)).toEqual([]);
        });
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

    test.each`
        flag                               | message
        ${'--values-file=build info.json'} | ${'Invalid --values-file "build info.json": no valid prefix can be derived'}
        ${'--value=version'}               | ${'Invalid --value "version": expected name=value.'}
        ${'--value==1.2.3'}                | ${'Invalid --value "=1.2.3": expected name=value.'}
        ${'--value-alias=version'}         | ${'Invalid --value-alias "version": expected name=target.'}
    `('$flag is a usage error', async ({ flag, message }) => {
        const command = new Command();
        const argv = createArgv('README.md', flag, '--dry-run');
        command.exitOverride(errorHandler);
        command.configureOutput({ writeErr: () => undefined });
        await expect(app.run(command, argv)).rejects.toThrow(message);
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

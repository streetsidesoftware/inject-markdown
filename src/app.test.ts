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
    `('run with errors $args', async ({ args }) => {
        const command = new Command();
        const argv = createArgv(args, '--output-dir=temp');
        command.exitOverride(errorHandler);
        await expect(app.run(command, argv)).rejects.toBeInstanceOf(CommanderError);
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

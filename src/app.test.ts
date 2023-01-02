import { describe, expect, test } from 'vitest';
import * as app from './app.mjs';
import { Command } from 'commander';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __file__ = fileURLToPath(import.meta.url);
const __dirname__ = path.dirname(__file__);
const __root__ = path.join(__dirname__, '..');

describe('app', () => {
    test('compiles', () => {
        expect(Object.keys(app).sort()).toMatchSnapshot();
    });

    test('help', async () => {
        const command = new Command();
        const argv = createArgv('README.md');
        await expect(app.run(command, argv)).resolves.toBeUndefined();
    });
});

function createArgv(...args: string[]): string[] {
    return [process.argv[0], path.join(__root__, 'bin.mjs'), ...args];
}

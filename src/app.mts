import {} from 'chalk';
import { Command, CommanderError, program as defaultCommand } from 'commander';
import * as fs from 'fs/promises';
import { globby } from 'globby';
import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { FileInjector } from './FileInjector.js';

const excludes = ['node_modules'];
const allowedFileExtensions: Record<string, boolean | undefined> = {
    '.md': true,
    '.mdx': true,
};

async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.basename(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf-8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
}

interface Options {
    mustFindFiles: boolean;
}

async function findFiles(globs: string[]) {
    const files = await globby(
        globs.map((a) => a.trim()).filter((a) => !!a),
        {
            ignore: excludes,
            onlyFiles: true,
        }
    );
    return files.filter((f) => path.extname(f) in allowedFileExtensions);
}

async function processGlobs(globs: string[], options: Options): Promise<boolean> {
    if (!globs.length) return false;

    const files = await findFiles(globs);

    if (!files.length) {
        return !options.mustFindFiles;
    }

    console.log('%o', files);

    const injector = new FileInjector(fs);

    for (const file of files) {
        const r = await injector.processFile(file);
        console.log('file: %s %o', file, r);
    }

    return true;
}

async function app(program = defaultCommand, argv?: string[]) {
    program
        .name('inject-markdown')
        .description('Inject file content into markdown files.')
        .argument('<files...>', 'Files to scan for injected content.')
        .option('--no-must-find-files', 'No error if files are not found.')
        .version(await version())
        .action(async (files: string[], options: Options, _command: Command) => {
            const result = await processGlobs(files, options);
            if (!result) {
                throw new CommanderError(1, 'Not Found', 'No files found.');
            }
        });

    program.showHelpAfterError();

    return program.parseAsync(argv);
}

export async function run(program?: Command): Promise<void> {
    try {
        await app(program);
    } catch (e) {
        process.exitCode = 1;
        if (!(e instanceof CommanderError)) {
            console.log(e);
            return;
        }
        console.log(e.message);
    }
}

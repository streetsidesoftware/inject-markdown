import { Command, CommanderError, program as defaultCommand } from 'commander';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { formatSummary } from './formatSummary.mjs';
import { Options, processGlobs } from './processGlobs.mjs';

async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
}

async function app(program = defaultCommand, argv?: string[]) {
    program
        .name('inject-markdown')
        .description('Inject file content into markdown files.')
        .argument('<files...>', 'Files to scan for injected content.')
        .option('--no-must-find-files', 'No error if files are not found.')
        .option('--output-dir <dir>', 'Output Directory')
        .option('--cwd <dir>', 'Current Directory')
        .option('--clean', 'Remove the injected content.')
        .option('--verbose', 'Verbose output.')
        .option('--silent', 'Only output errors.')
        .option('--no-stop-on-error', 'Do not stop if an error occurs.')
        .option('--write-on-error', 'write the file even if an injection error occurs.')
        .option('--color', 'Force color.')
        .option('--no-color', 'Do not use color.')
        .version(await version())
        .action(async (files: string[], options: Options, _command: Command) => {
            // console.log('Options: %o', options);
            const result = await processGlobs(files, options);
            console.log(formatSummary(result));
            if (result.errorCount) {
                process.exitCode = 1;
            }
            if (!result.numberOfFiles && options.mustFindFiles) {
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

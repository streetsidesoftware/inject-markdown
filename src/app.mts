import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { Command, Option as CommanderOption, program as defaultCommand } from 'commander';
import * as path from 'path';

import { type Options, processGlobs } from './processor/process.mjs';
import { formatSummary } from './reporting/formatSummary.mjs';

async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
}

interface CliOptions extends Options {
    /**
     * alternate spelling of option
     */
    stopOnError?: boolean;

    /**
     * Show the summary
     */
    summary?: boolean;
}

function fixOptions(options: CliOptions): Options {
    const opts: Options = options;

    if (options.stopOnError !== undefined) opts.stopOnErrors = options.stopOnError;
    if (options.stopOnErrors !== undefined) opts.stopOnErrors = options.stopOnErrors;
    opts.stopOnErrors = opts.stopOnErrors ?? true;
    return opts;
}

export async function app(program = defaultCommand): Promise<Command> {
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
        .addOption(new CommanderOption('--stop-on-errors', 'Stop if an error occurs.').hideHelp())
        .option('--no-stop-on-errors', 'Do not stop if an error occurs.')
        .addOption(new CommanderOption('--stop-on-error', 'Stop if an error occurs.').hideHelp())
        .addOption(new CommanderOption('--no-stop-on-error', 'Do not stop if an error occurs.').hideHelp())
        .option('--write-on-error', 'write the file even if an injection error occurs.')
        .option('--color', 'Force color.')
        .option('--no-color', 'Do not use color.')
        .addOption(new CommanderOption('--summary', 'Show summary even when silent.').hideHelp())
        .option('--no-summary', 'Do not show the summary')
        .option('--dry-run', 'Process the files, but do not write.')
        .version(await version())
        .action(async (files: string[], optionsCli: CliOptions, _command: Command) => {
            // console.log('Options: %o', optionsCli);
            program.showHelpAfterError(false);
            const option = fixOptions(optionsCli);
            const result = await processGlobs(files, option);
            const showSummary = (!optionsCli.silent && !!result.numberOfFiles) || optionsCli.summary === true;
            if (showSummary) console.error(chalk.white(formatSummary(result)));
            if (!result.numberOfFiles && optionsCli.mustFindFiles) {
                program.error('No Markdown files found.');
            }
            if (result.errorCount) {
                program.error('Encountered errors while processing.');
            }
        });

    program.showHelpAfterError();
    return program;
}

export async function run(program?: Command, argv?: string[]): Promise<void> {
    const prog = await app(program);
    await prog.parseAsync(argv);
}

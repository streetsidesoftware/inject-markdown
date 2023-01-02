import { Command, CommanderError, program as defaultCommand, Option as CommanderOption } from 'commander';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { formatSummary } from './reporting/formatSummary.mjs';
import { Options, processGlobs } from './processor/process.mjs';

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
    if (options.stopOnError || options.stopOnErrors) opts.stopOnErrors = true;
    return opts;
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
        .option('--no-stop-on-errors', 'Do not stop if an error occurs.')
        .addOption(new CommanderOption('--no-stop-on-error', 'Do not stop if an error occurs.').hideHelp())
        .option('--write-on-error', 'write the file even if an injection error occurs.')
        .option('--color', 'Force color.')
        .option('--no-color', 'Do not use color.')
        .addOption(new CommanderOption('--summary', 'Show summary even when silent.').hideHelp())
        .option('--no-summary', 'Do not show the summary')
        .version(await version())
        .action(async (files: string[], optionsCli: CliOptions, _command: Command) => {
            // console.log('Options: %o', options);
            const option = fixOptions(optionsCli);
            const showSummary = !optionsCli.silent || optionsCli.summary === true;
            const result = await processGlobs(files, option);
            showSummary && console.error(formatSummary(result));
            if (result.errorCount) {
                process.exitCode = 1;
            }
            if (!result.numberOfFiles && optionsCli.mustFindFiles) {
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

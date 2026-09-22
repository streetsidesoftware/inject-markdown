import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { Command, Option as CommanderOption, program as defaultCommand } from 'commander';
import * as path from 'path';

import { type Options, processGlobs } from './processor/process.mjs';
import { formatSummary } from './reporting/formatSummary.mjs';
import { OptionError } from './util/errors.js';

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
        .option(
            '--allow-outside-root <dir>',
            'Allow local @@inject references to resolve into <dir>, outside the injection root (cwd). Repeatable.',
            (dir: string, dirs: string[] = []) => [...dirs, dir],
        )
        .option(
            '--value <name=val>',
            'Set a run-wide {@ name @} placeholder value. Repeatable; a later --value for the same name wins.',
            (entry: string, acc: Record<string, string> = Object.create(null)) => {
                const idx = entry.indexOf('=');
                if (idx < 0) return acc;
                acc[entry.slice(0, idx).trim()] = entry.slice(idx + 1);
                return acc;
            },
        )
        .option(
            '--values-file <[prefix:]path>',
            'Add a run-wide JSON file of {@ name @} placeholder values, resolved relative to --cwd. Repeatable.',
            (path: string, paths: string[] = []) => [...paths, path],
        )
        .option(
            '--allow-env <name>',
            'Allow a directive to reference the OS environment variable <name> via {@ env.name @}. Repeatable.',
            (name: string, names: string[] = []) => [...names, name],
        )
        .option(
            '--value-alias <new=target>',
            'Resolve the {@ new @} placeholder as if it were {@ target @}. Repeatable; a later --value-alias for the same name wins.',
            (entry: string, acc: Record<string, string> = Object.create(null)) => {
                const idx = entry.indexOf('=');
                if (idx < 0) return acc;
                acc[entry.slice(0, idx).trim()] = entry.slice(idx + 1).trim();
                return acc;
            },
        )
        .option('--strict-vars', 'Treat an unresolved {@ name @} placeholder as a directive error.')
        .option('--clean', 'Remove the injected content.')
        .addOption(new CommanderOption('--inject-only', 'Only update the injected content.').default(true).hideHelp())
        .option('--no-inject-only', 'Update the whole file.')
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
            // A bad `--values-file` is operator input, not a document error: report it as a CLI
            // message rather than letting it escape as an uncaught exception.
            const result = await processGlobs(files, option).catch((e) => {
                if (e instanceof OptionError) program.error(chalk.red(e.message));
                throw e;
            });
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

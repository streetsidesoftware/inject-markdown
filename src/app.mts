import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { Command, Option as CommanderOption, program as defaultCommand } from 'commander';
import * as path from 'path';

import { type Options, processGlobs } from './processor/process.mjs';
import { formatSummary } from './reporting/formatSummary.mjs';
import { OptionError } from './util/errors.js';
import { getOutputWidth } from './util/outputWidth.js';
import { parseValuesFileEntry, type ValueDeclaration } from './util/values.js';

async function version(): Promise<string> {
    const pathSelf = fileURLToPath(import.meta.url);
    const pathPackageJson = path.join(path.dirname(pathSelf), '../package.json');
    const packageJson = JSON.parse(await fs.readFile(pathPackageJson, 'utf8'));
    return (typeof packageJson === 'object' && packageJson?.version) || '0.0.0';
}

/** A value flag as typed on the command line. */
interface ValueArg {
    flag: ValueFlag;
    raw: string;
}

interface CliOptions extends Options {
    /** Recorded in the shared list of value flags, not here. */
    value?: unknown;
    valuesFile?: unknown;
    valueAlias?: unknown;

    /** Alternate spelling of `stopOnErrors`. */
    stopOnError?: boolean;

    summary?: boolean;
}

/**
 * Turn the collected command-line options into run options.
 * Throws an `OptionError` for a value flag it can't parse.
 */
function fixOptions(options: CliOptions, valueArgs: readonly ValueArg[]): Options {
    const { value: _value, valuesFile: _valuesFile, valueAlias: _valueAlias, ...opts } = options;
    opts.valueDeclarations = valueArgs.map((arg) => parseValueFlag(arg.flag, arg.raw));

    opts.stopOnErrors = options.stopOnErrors ?? options.stopOnError ?? true;
    return opts;
}

type ValueFlag = 'value' | 'values-file' | 'value-alias';

function parseValueFlag(flag: ValueFlag, raw: string): ValueDeclaration {
    switch (flag) {
        case 'value': {
            const [name, value] = splitAssignment(flag, raw, 'name=value');
            return { kind: 'value', name, value };
        }
        case 'value-alias': {
            const [name, target] = splitAssignment(flag, raw, 'name=target');
            return { kind: 'alias', name, target: target.trim() };
        }
        case 'values-file': {
            const entry = parseValuesFileEntry(raw);
            if (!entry) {
                throw new OptionError(
                    `Invalid --values-file "${raw}": no valid prefix can be derived from the file name; ` +
                        `use prefix:${raw}, or :${raw} to merge at the root.`,
                );
            }
            return { kind: 'values-file', ...entry };
        }
    }
}

/** Split `name=rest` at the first `=`. The name is trimmed and must not be empty. */
function splitAssignment(flag: ValueFlag, raw: string, form: string): [name: string, rest: string] {
    const idx = raw.indexOf('=');
    const name = idx < 0 ? '' : raw.slice(0, idx).trim();
    if (!name) {
        throw new OptionError(`Invalid --${flag} "${raw}": expected ${form}.`);
    }
    return [name, raw.slice(idx + 1)];
}

export async function app(program = defaultCommand): Promise<Command> {
    // Value flags, in command-line order: a later declaration wins.
    // Commander calls each option's callback in that order, so one shared list keeps it.
    const valueArgs: ValueArg[] = [];
    const record = (flag: ValueFlag) => (raw: string) => {
        valueArgs.push({ flag, raw });
    };
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
            "Set a run-wide {@ name @} placeholder value. Repeatable; the last --value, --values-file or --value-alias defining a name wins. A directive's own values win over all of them.",
            record('value'),
        )
        .option(
            '--values-file <[prefix:]path>',
            'Add a run-wide JSON file of {@ name @} placeholder values, resolved relative to --cwd. Repeatable; ordered with --value.',
            record('values-file'),
        )
        .option(
            '--allow-env <name>',
            'Allow a directive to reference the OS environment variable <name> via {@ env.name @}. Repeatable.',
            (name: string, names: string[] = []) => [...names, name],
        )
        .option(
            '--value-alias <new=target>',
            'Resolve the {@ new @} placeholder as if it were {@ target @}. Repeatable; ordered with --value and --values-file.',
            record('value-alias'),
        )
        .option('--strict-vars', 'Treat an unresolved {@ name @} placeholder as a directive error.')
        .option('--no-rebase-links', 'Keep relative links in injected Markdown as written instead of rebasing them.')
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
            program.showHelpAfterError(false);
            // A bad value flag or values file is operator input, not a document error.
            // Report it as a CLI message rather than letting it escape as an uncaught exception.
            const run = async () => processGlobs(files, fixOptions(optionsCli, valueArgs));
            const result = await run().catch((e) => {
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
    program.configureOutput({
        getOutHelpWidth: () => getOutputWidth(process.stdout) ?? 80,
        getErrHelpWidth: () => getOutputWidth(process.stderr) ?? 80,
    });
    // Commander stops wrapping when the description column is under 40 wide.
    // That's too wide for narrow output.
    program.configureHelp({ minWidthToWrap: 20 });
    return program;
}

export async function run(program?: Command, argv?: string[]): Promise<void> {
    const prog = await app(program);
    await prog.parseAsync(argv);
}

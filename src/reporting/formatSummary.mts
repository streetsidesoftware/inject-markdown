import chalkDefault from 'chalk';

import type { Result } from '../processor/process.mjs';

export function formatSummary(r: Result, chalk = chalkDefault): string {
    return `\
Summary:
    Number of files:                    ${r.numberOfFiles}
    Number of files processed:          ${r.numberOfFilesProcessed}
    Number of files with injections:    ${r.numberOfFilesWithInjections}
    Number of files written:            ${r.numberOfFilesWritten}
    Number of files skipped:            ${
        r.numberOfFilesSkipped ? chalk.yellow(r.numberOfFilesSkipped) : r.numberOfFilesSkipped
    }
    Errors:                             ${r.errorCount ? chalk.red(r.errorCount) : r.errorCount}
`;
}

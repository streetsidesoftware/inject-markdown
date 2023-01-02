import { Chalk } from 'chalk';
import { describe, expect, test, beforeEach } from 'vitest';
import { formatSummary } from './formatSummary.mjs';

const chalk = new Chalk();

describe('formatSummary', () => {
    beforeEach(() => {
        chalk.level = 0;
    });
    test('formatSummary', () => {
        const result = {
            numberOfFiles: 0,
            numberOfFilesProcessed: 0,
            numberOfFilesWithInjections: 0,
            numberOfFilesUpdated: 0,
            numberOfFilesWritten: 0,
            numberOfFilesSkipped: 0,
            filesWithErrors: [],
            errorCount: 0,
        };
        expect(formatSummary(result, chalk)).toMatchSnapshot();
    });

    test('formatSummary with errors', () => {
        const result = {
            numberOfFiles: 1,
            numberOfFilesProcessed: 1,
            numberOfFilesWithInjections: 1,
            numberOfFilesUpdated: 0,
            numberOfFilesWritten: 0,
            numberOfFilesSkipped: 1,
            filesWithErrors: ['README.md'],
            errorCount: 1,
        };
        expect(formatSummary(result, chalk)).toMatchSnapshot();
    });
});

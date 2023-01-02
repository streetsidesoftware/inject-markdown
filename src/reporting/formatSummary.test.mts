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
});

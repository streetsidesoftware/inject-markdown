import * as fs from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import type { FileSystemAdapter } from './FileSystemAdapter.js';

describe('Validate FileSystemAdapter types', () => {
    test('FileSystemAdapter', () => {
        const adapter: FileSystemAdapter = fs;
        expect(adapter).toBeDefined();
    });
});

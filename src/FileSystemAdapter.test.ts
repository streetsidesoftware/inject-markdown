import { describe, expect, test } from 'vitest';
import type { FileSystemAdapter } from './FileSystemAdapter.js';
import * as fs from 'node:fs/promises';

describe('Validate FileSystemAdapter types', () => {
    test('FileSystemAdapter', () => {
        const adapter: FileSystemAdapter = fs;
        expect(adapter).toBeDefined();
    });
});

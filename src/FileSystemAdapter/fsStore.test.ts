import { describe, expect, test } from 'vitest';

import { createStore } from './fsStore.mjs';

describe('utils', () => {
    test('createStore', async () => {
        const store = createStore<string>();

        store.set('.', 'hello');
        expect(store.get('.')).toBe('hello');

        store.set('.', 'world');
        expect(store.get('.')).toBe('world');

        store.set('./file.txt', 'content');
        expect(store.get('.')).toBe('world');
        expect(store.get('./file.txt')).toBe('content');

        store.set('.', undefined);
        expect(store.get('.')).toBe(undefined);
    });
});

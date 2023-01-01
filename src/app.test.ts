import { describe, expect, test } from 'vitest';
import * as app from './app.mjs';

describe('app', () => {
    test('compiles', () => {
        expect(Object.keys(app).sort()).toMatchSnapshot();
    });
});

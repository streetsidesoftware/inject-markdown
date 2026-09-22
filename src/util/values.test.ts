import { describe, expect, test, vi } from 'vitest';

import type { FileSystemAdapter } from '../FileSystemAdapter/FileSystemAdapter.js';
import {
    buildValuesFileTree,
    deriveAutoPrefixFromPath,
    getPath,
    isScalar,
    isValidPlaceholderSegment,
    type JsonObject,
    parseValuesFileEntry,
    parseValuesFileList,
    parseValuesOption,
    setPath,
    treeFromFlatMap,
} from './values.js';

describe('parseValuesOption', () => {
    test.each`
        raw                      | expected
        ${'name:val'}            | ${new Map([['name', 'val']])}
        ${'name:val,name2:val2'} | ${new Map([['name', 'val'], ['name2', 'val2']])}
        ${' name : val , a:b '}  | ${new Map([['name', 'val'], ['a', 'b']])}
        ${'"name:1, 2, 3"'}      | ${new Map([['name', '1, 2, 3']])}
        ${''}                    | ${new Map()}
        ${'noColon'}             | ${new Map()}
    `('parseValuesOption($raw)', ({ raw, expected }) => {
        expect(parseValuesOption(raw)).toEqual(expected);
    });
});

describe('parseValuesFileEntry / parseValuesFileList', () => {
    test.each`
        raw                   | expected
        ${'package.json'}     | ${{ prefixKind: 'auto', path: 'package.json' }}
        ${'pkg:package.json'} | ${{ prefixKind: 'explicit', prefixName: 'pkg', path: 'package.json' }}
        ${':package.json'}    | ${{ prefixKind: 'root', path: 'package.json' }}
        ${'"C:\\foo.json"'}   | ${{ prefixKind: 'auto', path: 'C:\\foo.json' }}
    `('parseValuesFileEntry($raw)', ({ raw, expected }) => {
        expect(parseValuesFileEntry(raw)).toEqual(expected);
    });

    test('parseValuesFileList splits on commas outside quotes', () => {
        expect(parseValuesFileList('package.json,pkg:other.json,:root.json')).toEqual([
            { prefixKind: 'auto', path: 'package.json' },
            { prefixKind: 'explicit', prefixName: 'pkg', path: 'other.json' },
            { prefixKind: 'root', path: 'root.json' },
        ]);
    });

    test('parseValuesFileList keeps a quoted comma literal', () => {
        expect(parseValuesFileList('"a,b.json",other.json')).toEqual([
            { prefixKind: 'auto', path: 'a,b.json' },
            { prefixKind: 'auto', path: 'other.json' },
        ]);
    });
});

describe('deriveAutoPrefixFromPath / isValidPlaceholderSegment', () => {
    test.each`
        path                      | expected
        ${'package.json'}         | ${'package'}
        ${'../shared/build.json'} | ${'build'}
        ${'.env'}                 | ${'.env'}
        ${'v1.2.json'}            | ${'v1.2'}
        ${'build info.json'}      | ${'build info'}
    `('deriveAutoPrefixFromPath($path)', ({ path, expected }) => {
        expect(deriveAutoPrefixFromPath(path)).toBe(expected);
    });

    test.each`
        name            | expected
        ${'package'}    | ${true}
        ${'build-info'} | ${true}
        ${'v1.2'}       | ${false}
        ${'build info'} | ${false}
    `('isValidPlaceholderSegment($name)', ({ name, expected }) => {
        expect(isValidPlaceholderSegment(name)).toBe(expected);
    });
});

describe('getPath / setPath / treeFromFlatMap', () => {
    test('walks nested objects', () => {
        const tree: JsonObject = { package: { version: '1.2.3' } };
        expect(getPath(tree, 'package.version')).toBe('1.2.3');
        expect(getPath(tree, 'package.missing')).toBeUndefined();
        expect(getPath(tree, 'missing.path')).toBeUndefined();
    });

    test('setPath builds intermediate objects', () => {
        const tree: JsonObject = {};
        setPath(tree, 'package.version', '1.2.3');
        expect(tree).toEqual({ package: { version: '1.2.3' } });
    });

    test('treeFromFlatMap supports dotted names', () => {
        const tree = treeFromFlatMap(
            new Map([
                ['package.version', '1.2.3'],
                ['name', 'demo'],
            ]),
        );
        expect(tree).toEqual({ package: { version: '1.2.3' }, name: 'demo' });
    });

    test('treeFromFlatMap returns undefined for an empty map', () => {
        expect(treeFromFlatMap(undefined)).toBeUndefined();
        expect(treeFromFlatMap(new Map())).toBeUndefined();
    });
});

describe('isScalar', () => {
    test.each`
        value        | expected
        ${'string'}  | ${true}
        ${1}         | ${true}
        ${true}      | ${true}
        ${null}      | ${false}
        ${undefined} | ${false}
        ${{ a: 1 }}  | ${false}
        ${[1, 2]}    | ${false}
    `('isScalar($value)', ({ value, expected }) => {
        expect(isScalar(value)).toBe(expected);
    });
});

describe('buildValuesFileTree', () => {
    function fsWith(files: Record<string, string>): FileSystemAdapter {
        return {
            readFile: vi.fn(async (p: string | URL) => {
                const key = String(p);
                if (!(key in files)) throw new Error(`ENOENT: ${key}`);
                return files[key];
            }),
            writeFile: vi.fn(),
            mkdir: vi.fn(),
            realpath: vi.fn(async (p: string | URL) => String(p)),
        };
    }

    test('auto-derives a prefix from the basename', async () => {
        const fs = fsWith({ '/root/package.json': '{"version":"1.2.3"}' });
        const onError = vi.fn();
        const tree = await buildValuesFileTree(
            fs,
            [{ prefixKind: 'auto', path: 'package.json' }],
            async (p) => `/root/${p}`,
            onError,
        );
        expect(tree).toEqual({ package: { version: '1.2.3' } });
        expect(onError).not.toHaveBeenCalled();
    });

    test('root merge flattens top-level keys', async () => {
        const fs = fsWith({ '/root/data.json': '{"a":1,"b":2}' });
        const tree = await buildValuesFileTree(
            fs,
            [{ prefixKind: 'root', path: 'data.json' }],
            async (p) => `/root/${p}`,
            vi.fn(),
        );
        expect(tree).toEqual({ a: 1, b: 2 });
    });

    test('later entries win on a prefix collision', async () => {
        const fs = fsWith({
            '/root/a.json': '{"v":1}',
            '/root/b.json': '{"v":2}',
        });
        const tree = await buildValuesFileTree(
            fs,
            [
                { prefixKind: 'explicit', prefixName: 'ns', path: 'a.json' },
                { prefixKind: 'explicit', prefixName: 'ns', path: 'b.json' },
            ],
            async (p) => `/root/${p}`,
            vi.fn(),
        );
        expect(tree).toEqual({ ns: { v: 2 } });
    });

    test('an invalid auto-derived prefix is reported and the entry skipped', async () => {
        const fs = fsWith({ '/root/build info.json': '{"v":1}' });
        const onError = vi.fn();
        const tree = await buildValuesFileTree(
            fs,
            [{ prefixKind: 'auto', path: 'build info.json' }],
            async (p) => `/root/${p}`,
            onError,
        );
        expect(tree).toEqual({});
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Invalid values-file prefix'));
    });

    test('a read failure is reported and the entry skipped', async () => {
        const fs = fsWith({});
        const onError = vi.fn();
        const tree = await buildValuesFileTree(
            fs,
            [{ prefixKind: 'auto', path: 'missing.json' }],
            async (p) => `/root/${p}`,
            onError,
        );
        expect(tree).toEqual({});
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to read values file'));
    });
});

describe('prototype safety', () => {
    // Directive text is untrusted input (ADR-0003): no placeholder name may reach `Object.prototype`.
    test.each`
        name
        ${'__proto__.polluted'}
        ${'a.__proto__.polluted'}
        ${'constructor.prototype.polluted'}
    `('setPath drops the prototype-reaching name $name', ({ name }: { name: string }) => {
        const tree = treeFromFlatMap(new Map([[name, 'pwned']]));
        expect(getPath(tree, name)).toBe(undefined);
        expect(({} as Record<string, unknown>).polluted).toBe(undefined);
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    test('treeFromFlatMap builds a null-prototype tree', () => {
        const tree = treeFromFlatMap(new Map([['a.b', '1']]));
        expect(Object.getPrototypeOf(tree)).toBe(null);
        expect(Object.getPrototypeOf(getPath(tree, 'a') as object)).toBe(null);
    });

    test.each`
        name
        ${'toString'}
        ${'constructor'}
        ${'a.toString'}
    `('getPath does not resolve the inherited name $name', ({ name }: { name: string }) => {
        // `JSON.parse` results still inherit from `Object.prototype`, so the guard has to be in
        // `getPath`, not only in how the tree is built.
        const tree = JSON.parse('{"a":{}}') as JsonObject;
        expect(getPath(tree, name)).toBe(undefined);
    });

    test.each`
        segment
        ${'__proto__'}
        ${'constructor'}
        ${'prototype'}
    `('isValidPlaceholderSegment rejects $segment as a values-file prefix', ({ segment }: { segment: string }) => {
        expect(isValidPlaceholderSegment(segment)).toBe(false);
    });

    test('a `__proto__` key in a values file stays an inert own key', async () => {
        const fs: FileSystemAdapter = {
            readFile: vi.fn(async () => '{"__proto__":{"polluted":"pwned"},"ok":1}'),
            writeFile: vi.fn(),
            mkdir: vi.fn(),
            realpath: vi.fn(async (p: string | URL) => String(p)),
        };
        const tree = await buildValuesFileTree(
            fs,
            [{ prefixKind: 'root', path: 'data.json' }],
            async (p) => `/root/${p}`,
            vi.fn(),
        );
        expect(getPath(tree, 'ok')).toBe(1);
        expect(({} as Record<string, unknown>).polluted).toBe(undefined);
        expect(Object.prototype).not.toHaveProperty('polluted');
    });
});

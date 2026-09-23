import { describe, expect, test, vi } from 'vitest';

import type { FileSystemAdapter, PathLike } from '../FileSystemAdapter/FileSystemAdapter.js';
import {
    deriveAutoPrefixFromPath,
    getPath,
    isScalar,
    isValidPlaceholderSegment,
    isValidValuesFilePrefix,
    type JsonObject,
    layerFromPair,
    parseSingleValue,
    parseValuesFileEntry,
    parseValuesFileList,
    parseValuesPairs,
    readValuesFileLayer,
    resolveInLayers,
    setPath,
    type ValueLayer,
    type ValuesFileEntry,
} from './values.js';

/** Read entries in order into layers, newest (last-listed) first, skipping failures. */
async function buildValuesFileLayers(
    fs: FileSystemAdapter,
    entries: ValuesFileEntry[],
    resolvePath: (path: string) => Promise<PathLike>,
    onError: (message: string) => void,
): Promise<ValueLayer[]> {
    const layers: ValueLayer[] = [];
    for (const entry of entries) {
        const layer = await readValuesFileLayer(fs, entry, resolvePath, onError);
        if (layer) layers.push(layer);
    }
    return layers.reverse();
}

/** One layer per pair, newest (last-listed) first. */
function layersFromPairs(pairs: [string, string][]): ValueLayer[] {
    return pairs.map(([name, value]) => layerFromPair(name, value)).reverse();
}

describe('parseValuesPairs', () => {
    test.each`
        raw                      | expected
        ${'name:val'}            | ${[['name', 'val']]}
        ${'name:val,name2:val2'} | ${[['name', 'val'], ['name2', 'val2']]}
        ${' name : val , a:b '}  | ${[['name', 'val'], ['a', 'b']]}
        ${'"name:1, 2, 3"'}      | ${[['name', '1, 2, 3']]}
        ${'a:1,a:2'}             | ${[['a', '1'], ['a', '2']]}
        ${''}                    | ${[]}
        ${'noColon'}             | ${[]}
    `('parseValuesPairs($raw)', ({ raw, expected }) => {
        expect(parseValuesPairs(raw)).toEqual(expected);
    });
});

describe('parseSingleValue', () => {
    test.each`
        raw                | expected
        ${'range:1, 2, 3'} | ${['range', '1, 2, 3']}
        ${'url:https://x'} | ${['url', 'https://x']}
        ${' name : val '}  | ${['name', 'val']}
        ${'name:'}         | ${['name', '']}
        ${'noColon'}       | ${undefined}
        ${':1.0'}          | ${undefined}
    `('parseSingleValue($raw)', ({ raw, expected }) => {
        expect(parseSingleValue(raw)).toEqual(expected);
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

    test('layerFromPair nests a dotted name', () => {
        expect(layerFromPair('package.version', '1.2.3')).toEqual({ package: { version: '1.2.3' } });
    });

    test('one layer per pair keeps both names when one is a prefix of another', () => {
        // One folded tree would lose `a` to `a.b`; separate layers keep both (ADR-0008 point 1).
        const layers = layersFromPairs([
            ['a', '1'],
            ['a.b', '2'],
        ]);
        expect(resolveInLayers(layers, 'a')).toEqual({ value: '1' });
        expect(resolveInLayers(layers, 'a.b')).toEqual({ value: '2' });
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

describe('readValuesFileLayer', () => {
    function fsWith(files: Record<string, string>): FileSystemAdapter {
        return {
            readFile: vi.fn(async (p: string | URL): Promise<string> => {
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
        const layers = await buildValuesFileLayers(
            fs,
            [{ prefixKind: 'auto', path: 'package.json' }],
            async (p: string) => `/root/${p}`,
            onError,
        );
        expect(layers).toEqual([{ package: { version: '1.2.3' } }]);
        expect(onError).not.toHaveBeenCalled();
    });

    test('root merge flattens top-level keys', async () => {
        const fs = fsWith({ '/root/data.json': '{"a":1,"b":2}' });
        const layers = await buildValuesFileLayers(
            fs,
            [{ prefixKind: 'root', path: 'data.json' }],
            async (p: string) => `/root/${p}`,
            vi.fn(),
        );
        expect(layers).toEqual([{ a: 1, b: 2 }]);
    });

    test('later entries win on a prefix collision, per leaf', async () => {
        const fs = fsWith({
            '/root/a.json': '{"v":1,"onlyInA":"A"}',
            '/root/b.json': '{"v":2}',
        });
        const layers = await buildValuesFileLayers(
            fs,
            [
                { prefixKind: 'explicit', prefixName: 'ns', path: 'a.json' },
                { prefixKind: 'explicit', prefixName: 'ns', path: 'b.json' },
            ],
            async (p: string) => `/root/${p}`,
            vi.fn(),
        );
        // Last-listed first (ADR-0008 point 2), and `a.json` survives underneath it (point 3).
        expect(layers).toEqual([{ ns: { v: 2 } }, { ns: { v: 1, onlyInA: 'A' } }]);
        expect(resolveInLayers(layers, 'ns.v')).toEqual({ value: '2' });
        expect(resolveInLayers(layers, 'ns.onlyInA')).toEqual({ value: 'A' });
    });

    test('an invalid auto-derived prefix is reported and the entry skipped', async () => {
        const fs = fsWith({ '/root/build info.json': '{"v":1}' });
        const onError = vi.fn();
        const layers = await buildValuesFileLayers(
            fs,
            [{ prefixKind: 'auto', path: 'build info.json' }],
            async (p: string) => `/root/${p}`,
            onError,
        );
        expect(layers).toEqual([]);
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Invalid values-file prefix'));
    });

    test('a read failure is reported and the entry skipped', async () => {
        const fs = fsWith({});
        const onError = vi.fn();
        const layers = await buildValuesFileLayers(
            fs,
            [{ prefixKind: 'auto', path: 'missing.json' }],
            async (p: string) => `/root/${p}`,
            onError,
        );
        expect(layers).toEqual([]);
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
        const layers = layersFromPairs([[name, 'pwned']]);
        expect(resolveInLayers(layers, name)).toEqual({ unresolved: 'undefined' });
        expect(({} as Record<string, unknown>).polluted).toBe(undefined);
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    test('layerFromPair builds null-prototype layers', () => {
        const layer = layerFromPair('a.b', '1');
        expect(Object.getPrototypeOf(layer)).toBe(null);
        expect(Object.getPrototypeOf(getPath(layer, 'a') as object)).toBe(null);
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
        const layers = await buildValuesFileLayers(
            fs,
            [{ prefixKind: 'root', path: 'data.json' }],
            async (p: string) => `/root/${p}`,
            vi.fn(),
        );
        expect(resolveInLayers(layers, 'ok')).toEqual({ value: '1' });
        expect(({} as Record<string, unknown>).polluted).toBe(undefined);
        expect(Object.prototype).not.toHaveProperty('polluted');
    });
});

describe('resolveInLayers', () => {
    const layer = (o: Record<string, unknown>): JsonObject => Object.assign(Object.create(null), o);

    test('takes the first layer holding the name as a scalar', () => {
        const layers = [layer({ v: 'high' }), layer({ v: 'low' })];
        expect(resolveInLayers(layers, 'v')).toEqual({ value: 'high' });
    });

    test('a missing leaf falls through to a lower layer', () => {
        // The cross-source case: --value patches one leaf, the values file supplies its siblings.
        const layers = [layer({ package: { engines: { node: '26.0' } } }), layer({ package: { version: '1.0.0' } })];
        expect(resolveInLayers(layers, 'package.engines.node')).toEqual({ value: '26.0' });
        expect(resolveInLayers(layers, 'package.version')).toEqual({ value: '1.0.0' });
    });

    test.each`
        blocking    | kind
        ${{ a: 1 }} | ${'object'}
        ${[1, 2]}   | ${'array'}
        ${null}     | ${'null'}
    `('a $kind in a higher layer does not stop the search', ({ blocking }: { blocking: unknown }) => {
        const layers = [layer({ v: blocking }), layer({ v: 'reachable' })];
        expect(resolveInLayers(layers, 'v')).toEqual({ value: 'reachable' });
    });

    test.each`
        blocking    | kind
        ${{ a: 1 }} | ${'object'}
        ${[1, 2]}   | ${'array'}
        ${null}     | ${'null'}
    `('reports $kind when no layer holds a scalar', ({ blocking, kind }: { blocking: unknown; kind: string }) => {
        expect(resolveInLayers([layer({ v: blocking })], 'v')).toEqual({ unresolved: kind });
    });

    test('reports undefined when nothing mentions the name', () => {
        expect(resolveInLayers([layer({ other: 'x' })], 'v')).toEqual({ unresolved: 'undefined' });
        expect(resolveInLayers([], 'v')).toEqual({ unresolved: 'undefined' });
    });

    test('coerces numbers and booleans to strings', () => {
        const layers = [layer({ n: 42, b: false })];
        expect(resolveInLayers(layers, 'n')).toEqual({ value: '42' });
        expect(resolveInLayers(layers, 'b')).toEqual({ value: 'false' });
    });
});

describe('prefix grammar (ADR-0009)', () => {
    test.each`
        entry                     | kind          | prefix         | path
        ${'pkg:data.json'}        | ${'explicit'} | ${'pkg'}       | ${'data.json'}
        ${'pkg.build:data.json'}  | ${'explicit'} | ${'pkg.build'} | ${'data.json'}
        ${'C:\\data\\v.json'}     | ${'auto'}     | ${undefined}   | ${'C:\\data\\v.json'}
        ${'C:/data/v.json'}       | ${'auto'}     | ${undefined}   | ${'C:/data/v.json'}
        ${'c:package.json'}       | ${'auto'}     | ${undefined}   | ${'c:package.json'}
        ${'v:data.json'}          | ${'auto'}     | ${undefined}   | ${'v:data.json'}
        ${'..:x.json'}            | ${'auto'}     | ${undefined}   | ${'..:x.json'}
        ${'-foo:x.json'}          | ${'auto'}     | ${undefined}   | ${'-foo:x.json'}
        ${'\\\\?\\C:\\d\\v.json'} | ${'auto'}     | ${undefined}   | ${'\\\\?\\C:\\d\\v.json'}
        ${':root.json'}           | ${'root'}     | ${undefined}   | ${'root.json'}
    `('$entry -> $kind', ({ entry, kind, prefix, path }: Record<string, string | undefined>) => {
        const e = parseValuesFileEntry(entry as string);
        expect(e.prefixKind).toBe(kind);
        expect(e.prefixName).toBe(prefix);
        expect(e.path).toBe(path);
    });

    test.each`
        name             | valid
        ${'pkg'}         | ${true}
        ${'build-info'}  | ${true}
        ${'pkg.build'}   | ${true}
        ${'_x'}          | ${true}
        ${'a'}           | ${false}
        ${'C'}           | ${false}
        ${'..'}          | ${false}
        ${'...'}         | ${false}
        ${'.env'}        | ${false}
        ${'-foo'}        | ${false}
        ${'a.'}          | ${false}
        ${'a..b'}        | ${false}
        ${'pkg.-x'}      | ${false}
        ${'__proto__'}   | ${false}
        ${'a.__proto__'} | ${false}
    `('isValidValuesFilePrefix($name) === $valid', ({ name, valid }: { name: string; valid: boolean }) => {
        expect(isValidValuesFilePrefix(name)).toBe(valid);
    });

    test.each`
        path                           | prefix
        ${'c:package.json'}            | ${'package'}
        ${'C:\\data\\values.json'}     | ${'values'}
        ${'C:/data/values.json'}       | ${'values'}
        ${'d:values.json'}             | ${'values'}
        ${'../shared/build-info.json'} | ${'build-info'}
    `('deriveAutoPrefixFromPath($path) strips the drive -> $prefix', ({ path, prefix }: Record<string, string>) => {
        expect(deriveAutoPrefixFromPath(path)).toBe(prefix);
    });

    test('an auto-derived prefix stays a single segment (ADR-0007 point 5 stands)', () => {
        expect(isValidPlaceholderSegment(deriveAutoPrefixFromPath('v1.2.json'))).toBe(false);
        expect(isValidPlaceholderSegment(deriveAutoPrefixFromPath('data.local.json'))).toBe(false);
    });

    test.each`
        segment   | valid
        ${'foo'}  | ${true}
        ${'a-b'}  | ${true}
        ${'_a'}   | ${true}
        ${'foo-'} | ${true}
        ${'-foo'} | ${false}
        ${'.foo'} | ${false}
    `(
        'isValidPlaceholderSegment($segment) === $valid (ADR-0001)',
        ({ segment, valid }: { segment: string; valid: boolean }) => {
            expect(isValidPlaceholderSegment(segment)).toBe(valid);
        },
    );
});

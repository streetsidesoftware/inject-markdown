import type { Root } from 'mdast';
import { describe, expect, test, vi } from 'vitest';

import { substituteInString, substituteInTree } from './placeholders.js';

describe('substituteInString', () => {
    test.each`
        text                       | values                            | expected
        ${'v{@ version @}'}        | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'v{@version@}'}          | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'v{@  version  @}'}      | ${{ version: '1.2.3' }}           | ${'v1.2.3'}
        ${'{@ package.version @}'} | ${{ 'package.version': '9.9.9' }} | ${'9.9.9'}
        ${'no placeholder here'}   | ${{}}                             | ${'no placeholder here'}
        ${'\\{@ version @}'}       | ${{ version: '1.2.3' }}           | ${'{@ version @}'}
    `('substituteInString($text)', ({ text, values, expected }) => {
        const resolve = (name: string): string | undefined => values[name];
        const onUnresolved = vi.fn();
        expect(substituteInString(text, resolve, onUnresolved)).toBe(expected);
        expect(onUnresolved).not.toHaveBeenCalled();
    });

    test('reports an unresolved placeholder and leaves it untouched', () => {
        const onUnresolved = vi.fn();
        const result = substituteInString('{@ missing @}', () => undefined, onUnresolved);
        expect(result).toBe('{@ missing @}');
        expect(onUnresolved).toHaveBeenCalledWith('missing');
    });

    test('reports each occurrence of a repeated unresolved name', () => {
        const onUnresolved = vi.fn();
        substituteInString('{@ missing @} and {@ missing @}', () => undefined, onUnresolved);
        expect(onUnresolved).toHaveBeenCalledTimes(2);
    });
});

describe('substituteInTree', () => {
    function root(children: Root['children']): Root {
        return { type: 'root', children };
    }

    test('substitutes in text, inlineCode, code, and html nodes', () => {
        const tree = root([
            { type: 'paragraph', children: [{ type: 'text', value: 'v{@ version @}' }] },
            { type: 'paragraph', children: [{ type: 'inlineCode', value: 'pkg@{@ version @}' }] },
            { type: 'code', lang: null, value: "print('{@ version @}')" },
            { type: 'html', value: '<!-- {@ version @} -->' },
        ]);
        const onUnresolved = vi.fn();
        substituteInTree(tree, () => '1.2.3', onUnresolved);
        expect(onUnresolved).not.toHaveBeenCalled();
        expect((tree.children[0] as { children: { value: string }[] }).children[0].value).toBe('v1.2.3');
        expect((tree.children[1] as { children: { value: string }[] }).children[0].value).toBe('pkg@1.2.3');
        expect((tree.children[2] as { value: string }).value).toBe("print('1.2.3')");
        expect((tree.children[3] as { value: string }).value).toBe('<!-- 1.2.3 -->');
    });
});

describe('name grammar (ADR-0001)', () => {
    const resolve = (name: string) => (name === 'ok' || name === 'a-b' ? 'X' : undefined);

    test.each`
        text            | expected        | why
        ${'{@ ok @}'}   | ${'X'}          | ${'plain name'}
        ${'{@ a-b @}'}  | ${'X'}          | ${'hyphen inside a segment'}
        ${'{@ -foo @}'} | ${'{@ -foo @}'} | ${'leading hyphen is not a placeholder'}
        ${'{@ a.-b @}'} | ${'{@ a.-b @}'} | ${'segment starting with a hyphen'}
        ${'{@ .foo @}'} | ${'{@ .foo @}'} | ${'leading dot'}
    `('$why', ({ text, expected }: Record<string, string>) => {
        expect(substituteInString(text, resolve, () => undefined)).toBe(expected);
    });

    test('a name that is not a placeholder reports nothing unresolved', () => {
        const unresolved: string[] = [];
        substituteInString('{@ -foo @}', resolve, (n) => unresolved.push(n));
        expect(unresolved).toEqual([]);
    });
});

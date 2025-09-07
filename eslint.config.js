// @ts-check

// import globals from 'globals';
import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        ignores: [
            'node_modules',
            'dist',
            'build',
            'temp',
            'coverage',
            'vitest.config.*',
            'sample-*',
            'fixtures*',
            'content',
        ],
    },
    {
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },
    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        rules: {
            'no-console': 'warn',
            'no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            'no-redeclare': 'off',
            'no-shadow': 'off',
        },
    },
    {
        files: ['**/*.{ts,mts,cts,tsx}'],
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
);

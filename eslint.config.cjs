const js = require('@eslint/js');

module.exports = [
    // Base Config
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...require('globals').browser,
                ...require('globals').node,
            },
        },
    },

    // Files to Ignore
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/out/**',
            '**/.next/**',
            '**/.nuxt/**',
            '**/.vuepress/**',
            '**/.docusaurus/**',
            '**/public/**',
            '**/.git/**',
            '**/.svn/**',
            '**/.hg/**',
            '**/.DS_Store',
            '**/Thumbs.db',
            '**/*.min.js',
            '**/*.bundle.js',
            '**/*.config.js',
            '**/*.config.cjs',
            '**/*.config.mjs',
        ],
    },

    // Rules for All Files
    (() => {
        const stylistic = require('@stylistic/eslint-plugin');
        let tsParser;
        let typescriptEslint;
        let hasTypeScript = false;

        try {
            tsParser = require('@typescript-eslint/parser');
            typescriptEslint = require('@typescript-eslint/eslint-plugin');
            hasTypeScript = true;
        } catch {
            // TypeScript not available
        }

        return {
            files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.tsx'],
            plugins: {
                '@stylistic': stylistic,
                ...(hasTypeScript ? { '@typescript-eslint': typescriptEslint } : {}),
            },
            languageOptions: hasTypeScript ? {
                parser: tsParser,
                parserOptions: {
                    project: true,
                },
            } : {},
            rules: {
                // Core Rules
                'no-console': ['warn', { allow: ['warn', 'error'] }],

                // Stylistic Rules
                '@stylistic/indent': ['error', 4, {
                    SwitchCase: 1,
                    VariableDeclarator: 'first',
                    FunctionDeclaration: { parameters: 'first' },
                    FunctionExpression: { parameters: 'first' },
                    CallExpression: { arguments: 'first' },
                    ArrayExpression: 'first',
                    ObjectExpression: 'first',
                    ImportDeclaration: 'first',
                }],
                '@stylistic/semi': ['error', 'always'],
                '@stylistic/quotes': ['error', 'single'],
                '@stylistic/comma-dangle': ['error', 'always-multiline'],
                '@stylistic/spaced-comment': ['error', 'always', {
                    line: {
                        markers: ['/'],
                        exceptions: ['-', '+', '*'],
                    },
                    block: {
                        markers: ['!'],
                        exceptions: ['*'],
                        balanced: true,
                    },
                }],
                '@stylistic/arrow-parens': ['error', 'always'],
                '@stylistic/keyword-spacing': 'error',
                '@stylistic/space-before-blocks': 'error',
                '@stylistic/space-infix-ops': 'error',
                '@stylistic/padding-line-between-statements': [
                    'error',
                    { blankLine: 'always', prev: '*', next: ['return', 'function', 'if', 'try'] },
                    { blankLine: 'always', prev: 'directive', next: '*' },
                ],
                '@stylistic/space-before-function-paren': ['error', {
                    anonymous: 'never',
                    named: 'never',
                    asyncArrow: 'always',
                }],
                '@stylistic/key-spacing': ['error', {
                    align: {
                        beforeColon: true,
                        afterColon: true,
                        on: 'colon',
                    },
                }],

                // TypeScript Rules (only applied when TypeScript is available)
                ...(hasTypeScript ? {
                    ...typescriptEslint.configs['recommended'].rules,
                    '@typescript-eslint/no-unused-vars': 'warn',
                    '@typescript-eslint/no-explicit-any': 'warn',
                    '@typescript-eslint/explicit-module-boundary-types': 'off',
                    '@typescript-eslint/no-non-null-assertion': 'warn',
                    '@typescript-eslint/ban-ts-comment': 'warn',
                } : {}),
            },
        };
    })(),
];

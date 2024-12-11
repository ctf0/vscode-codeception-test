const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const stylistic = require("@stylistic/eslint-plugin");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [{
    ignores: ["**/.eslintrc.js", "./.eslintrc.js"],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        "@stylistic": stylistic,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.commonjs,
            ...globals.node,
            ...globals.amd,
        },

        ecmaVersion: 11,
        sourceType: "module",
    },

    rules: {
        "@/strict": 0,
        "@/no-useless-escape": 1,

        "@/no-console": [1, {
            allow: ["warn", "error"],
        }],

        "@/no-template-curly-in-string": 1,
        "@/block-scoped-var": 1,
        "@/no-multi-str": 1,
        "@/no-extra-parens": [1, "functions"],

        "@/spaced-comment": [2, "always", {
            line: {
                markers: ["/"],
                exceptions: ["-", "+", "*"],
            },

            block: {
                markers: ["!"],
                exceptions: ["*"],
                balanced: true,
            },
        }],

        "@/indent": [2, 4, {
            SwitchCase: 1,
            VariableDeclarator: "first",

            FunctionDeclaration: {
                parameters: "first",
            },

            FunctionExpression: {
                parameters: "first",
            },

            CallExpression: {
                arguments: "first",
            },

            ArrayExpression: "first",
            ObjectExpression: "first",
            ImportDeclaration: "first",
        }],

        "@/semi": [2, "always"],
        "@/no-undef": 1,
        "@/comma-dangle": [2, "always-multiline"],
        "@/func-names": [1, "as-needed"],
        "@/global-require": 0,
        "@/quotes": [2, "single"],
        "@/new-parens": 2,
        "@/no-lonely-if": 0,

        "@/padding-line-between-statements": [2, {
            blankLine: "always",
            prev: "*",
            next: ["if", "return", "try", "function"],
        }, {
                blankLine: "always",
                prev: "directive",
                next: "*",
            }],

        "@/no-mixed-operators": [1, {
            groups: [
                ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
                ["&&", "||"],
                ["in", "instanceof"],
            ],

            allowSamePrecedence: true,
        }],

        "@/valid-typeof": [2, {
            requireStringLiterals: false,
        }],

        "@/arrow-parens": [2, "always"],

        "@/no-confusing-arrow": [2, {
            allowParens: true,
        }],

        "@/arrow-spacing": 1,
        "@/keyword-spacing": 1,
        "@/space-before-blocks": 1,
        "@/switch-colon-spacing": 1,

        "@/comma-spacing": [1, {
            before: false,
            after: true,
        }],

        "@/func-call-spacing": [1, "never"],
        "@/block-spacing": [1, "never"],
        "@/no-whitespace-before-property": 1,
        "@/no-prototype-builtins": 0,
        "@/space-infix-ops": 1,

        "@/no-empty": [1, {
            allowEmptyCatch: true,
        }],

        "@/key-spacing": [1, {
            align: {
                beforeColon: true,
                afterColon: true,
                on: "colon",
            },
        }],

        "@/space-unary-ops": [1, {
            words: true,
            nonwords: false,
        }],

        "@/no-duplicate-imports": [2, {
            includeExports: true,
        }],

        "@/no-compare-neg-zero": 0,

        "@/camelcase": [1, {
            properties: "always",
            ignoreDestructuring: true,
            ignoreImports: true,
            ignoreGlobals: true,
        }],

        "@/quote-props": [2, "consistent-as-needed"],

        "@/func-name-matching": [2, {
            considerPropertyDescriptor: true,
        }],

        "@/space-before-function-paren": [2, {
            anonymous: "never",
            named: "never",
            asyncArrow: "always",
        }],

        "@/prefer-arrow-callback": 2,
        "@/arrow-body-style": [2, "as-needed"],
        "@typescript-eslint/no-unused-vars": 0,
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/explicit-module-boundary-types": 0,
        "@typescript-eslint/no-non-null-assertion": 0,
        "@typescript-eslint/ban-ts-comment": 0,
    },
}];

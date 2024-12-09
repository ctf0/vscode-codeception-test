import * as vscode from 'vscode';

export enum CodeceptionConfigFile {
    YML = 'codeception.yml',
    YAML = 'codeception.yaml',
}

export enum VIEW_MODE {
    SUITES = 'suites',
    DIRECTORIES = 'directories',
}

/**
 * VS Code extension settings
 */
export interface ExtensionConfig {
    testFilePattern               : string;
    configFilePattern             : string;
    codecept                      : string;
    additionalArgs                : string[];
    debugArgs                     : string[];
    coverageArgs                  : string[];
    runArgs                       : string[];
    command                       : string;
    debugCommand                  : string;
    coverageHtmlFilePath          : string;
    coverageXmlFilePath           : string;
    viewMode                      : VIEW_MODE;
    pathMapping                   : Record<string, string>;
    useNearestConfigFile          : boolean;
    disableRunningSingleTestCases : boolean;
}

export interface DocBlock {
    body: Array<{
        kind         : string;
        name         : string;
        description? : string;
        options?: Array<{
            value: string;
        }>;
    }>;
}

export interface TestMethod {
    name      : string;
    docblock? : DocBlock;
    tags      : vscode.TestTag[];
    startLine : number;
    endLine   : number;
    testItem? : vscode.TestItem;
}

export interface TestClass {
    name        : string;
    fullName    : string;  // Full class name with namespace
    methods     : TestMethod[];
    tags        : vscode.TestTag[];
    uri         : vscode.Uri;
    suite?      : string;
    startLine   : number;
    endLine     : number;
    docblock?   : string;
    testItem?   : vscode.TestItem;
    configFile? : string;
}

/**
 * Codeception YAML file format
 */
export interface CodeceptionYamlConfig {
    paths?: {
        tests?   : string;
        output?  : string;
        data?    : string;
        support? : string;
    };
    settings?: {
        coverage?: {
            enabled?           : boolean;
            include?           : string[];
            exclude?           : string[];
            show_uncovered?    : boolean;
            show_only_summary? : boolean;
            report?: {
                html? : string;
                xml?  : string;
                php?  : string;
                text? : string;
            };
            remote?                 : boolean;
            remote_context_options?: {
                http?: {
                    timeout?: number;
                };
            };
        };
    };
    suites?: Record<string, {
        path?       : string;
        class_name? : string;
        modules?    : Record<string, any>;
    }>;
}

export interface TestCommandData {
    className?  : string;
    method?     : string;
    configFile? : string;
}

export interface TestExecutionOptions {
    className   : string;
    method?     : string;
    configFile? : string;
}

export interface CoverageData {
    file  : string;
    lines: {
        covered   : number[];
        uncovered : number[];
    };
}

export { TestClass as ITestClass, TestMethod as ITestMethod };

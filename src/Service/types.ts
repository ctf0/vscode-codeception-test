import * as vscode from 'vscode';

export enum CodeceptionConfigFile {
    YML = 'codeception.yml',
    YAML = 'codeception.yaml'
}

export interface CodeceptionConfig {
    testFilePattern: string;
    codecept: string;
    additionalArgs: string[];
    debugArgs: string[];
    coverageArgs: string[];
    runArgs: string[];
    command: string;
    debugCommand: string;
    envVars: Record<string, string>;
    configFile?: string;  // Path to codeception.yml file if found
    coverageHtmlFilePath: string;
    coverageXmlFilePath: string;
    pathMapping: Record<string, string>;
}

export interface TestMethod {
    name: string;
    docblock?: string;
    startLine: number;
    endLine: number;
    testItem?: vscode.TestItem;
}

export interface TestClass {
    name: string;
    fullName: string;  // Full class name with namespace
    methods: TestMethod[];
    uri: vscode.Uri;
    suite?: string;
    startLine: number;
    endLine: number;
    docblock?: string;
    testItem?: vscode.TestItem;
    configFile?: string;
}

export interface CodeceptConfig {
    paths?: {
        tests?: string;
        output?: string;
        data?: string;
        support?: string;
    };
    settings?: {
        coverage?: {
            enabled?: boolean;
            include?: string[];
            exclude?: string[];
            show_uncovered?: boolean;
            show_only_summary?: boolean;
            report?: {
                html?: string;
                xml?: string;
                php?: string;
                text?: string;
            };
            remote?: boolean;
            remote_context_options?: {
                http?: {
                    timeout?: number;
                };
            };
        };
    };
    suites?: Record<string, {
        path?: string;
        class_name?: string;
        modules?: Record<string, any>;
    }>;
}

export interface TestCommandData {
    className?: string;
    method?: string;
    configFile?: string;
}

export { TestClass as ITestClass, TestMethod as ITestMethod };

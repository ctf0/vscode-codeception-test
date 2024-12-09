import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CodeceptConfigReader } from '../Config/codeceptConfig';
import { ConfigurationService } from '../Service/Config/ConfigurationService';
import { CodeceptionCoverageProvider } from '../Coverage/coverageProvider';
import { TestData } from '../Model/testData';
import { PhpTestParser } from '../Service/parser';
import { TestExecutor } from '../Service/TestExecutor';
import { TestRunner } from '../Service/TestRunner';
import { TestProfileManager } from '../Service/TestProfileManager';
import { TestClass } from '../Service/types';

export class CodeceptionTestController {
    private testData: TestData = new TestData();
    private parser: PhpTestParser;
    private configReader: CodeceptConfigReader;
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private refreshTimeout: NodeJS.Timeout | null = null;
    private disposables: vscode.Disposable[] = [];
    private testController: vscode.TestController;
    private outputChannel: vscode.OutputChannel;
    private coverageProvider: CodeceptionCoverageProvider;
    private testRunner: TestRunner;
    private testProfileManager: TestProfileManager;

    constructor(private workspaceFolder: vscode.WorkspaceFolder) {
        this.testController = vscode.tests.createTestController('codeception', 'Codeception');
        this.configReader = new CodeceptConfigReader(workspaceFolder);
        this.parser = new PhpTestParser();
        this.outputChannel = vscode.window.createOutputChannel('Codeception Tests');
        this.coverageProvider = new CodeceptionCoverageProvider(workspaceFolder);
        
        // Initialize services
        this.testRunner = new TestRunner(
            this.testController,
            this.testData,
            workspaceFolder,
            this.outputChannel,
            this.coverageProvider
        );
        this.testProfileManager = new TestProfileManager(this.testController, this.testRunner);

        this.setupFileWatcher();

        this.disposables.push(
            this.testController,
            this.outputChannel,
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e)),
            vscode.workspace.onDidCreateFiles(() => this.scheduleRefresh()),
            vscode.workspace.onDidDeleteFiles(() => this.scheduleRefresh()),
            vscode.workspace.onDidRenameFiles(() => this.scheduleRefresh()),
        );

        this.testController.resolveHandler = async test => {
            if (!test) {
                await this.discoverAllTests();
                return;
            }
            await this.resolveTestItem(test);
        };

        void this.discoverAllTests();
    }

    private setupFileWatcher() {
        this.fileWatcher?.dispose();
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceFolder, '**/*{Cest,Test}.php'),
            false,
            false,
            false
        );

        this.fileWatcher.onDidChange(() => this.scheduleRefresh());
        this.fileWatcher.onDidCreate(() => this.scheduleRefresh());
        this.fileWatcher.onDidDelete(() => this.scheduleRefresh());

        this.disposables.push(this.fileWatcher);
    }

    private async refreshTestItems() {
        const testFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(this.workspaceFolder, '**/*{Cest,Test}.php'),
            '**/vendor/**'
        );

        const items: TestClass[] = [];
        for (const file of testFiles) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const testClass = await this.parser.parseTestFile(content.toString());
                if (testClass) {
                    testClass.uri = file;
                    items.push(testClass);
                }
            } catch (error) {
                console.error(`Error parsing file ${file.fsPath}:`, error);
            }
        }

        // Group items by suite
        const groupedItems = await this.createSuiteGroupedItems(items);
        this.testController.items.replace(groupedItems);
    }

    private async createSuiteGroupedItems(items: TestClass[]): Promise<vscode.TestItem[]> {
        const groups = new Map<string, vscode.TestItem>();
        const configResult = await this.configReader.getConfig();
        const suites = configResult?.suites || {};

        // Helper function to find the most specific matching path
        const findSuite = (filePath: string): string => {
            let matchedSuite = 'default';
            let longestMatch = '';

            for (const [suite, { path }] of Object.entries(suites)) {
                const normalizedPath = path.replace(/^\.\//, '').replace(/\\/g, '/');
                const normalizedFile = filePath.replace(/\\/g, '/');

                if (normalizedFile.startsWith(normalizedPath) && normalizedPath.length > longestMatch.length) {
                    longestMatch = normalizedPath;
                    matchedSuite = suite;
                }
            }

            return matchedSuite;
        };

        // Group items by suite
        for (const item of items) {
            const relativePath = vscode.workspace.asRelativePath(item.uri);
            const suiteName = findSuite(relativePath);

            let groupItem = groups.get(suiteName);
            if (!groupItem) {
                groupItem = this.testController.createTestItem(
                    `suite:${suiteName}`,
                    suiteName,
                    undefined
                );
                groupItem.description = 'Test Suite';
                groups.set(suiteName, groupItem);
            }

            const testItem = this.createTestItem(item);
            groupItem.children.add(testItem);
        }

        return Array.from(groups.values());
    }

    private createTestItem(item: TestClass): vscode.TestItem {
        const testItem = this.testController.createTestItem(
            `test:${item.fullName}`,
            `$(symbol-class) ${item.name}`,
            item.uri
        );

        testItem.canResolveChildren = true;
        testItem.range = new vscode.Range(
            item.startLine,
            0,
            item.endLine,
            0
        );
        this.testData.setItem(testItem.id, item);

        return testItem;
    }

    public async discoverAllTests() {
        try {
            await this.refreshTestItems();
        } catch (error) {
            console.error('Error discovering tests:', error);
        }
    }

    private async resolveTestItem(test: vscode.TestItem): Promise<void> {
        if (!test.uri) {
            return;
        }

        try {
            const content = await vscode.workspace.fs.readFile(test.uri);
            const testClass = await this.parser.parseTestFile(content.toString());

            if (!testClass) {
                return;
            }

            // Clear existing children
            test.children.replace([]);

            for (const method of testClass.methods) {
                const testItem = this.testController.createTestItem(
                    `${test.uri.fsPath}:${method.name}`,
                    `$(symbol-method) ${method.name}`,
                    test.uri
                );

                testItem.tags = [...(test.tags || [])];
                testItem.range = new vscode.Range(
                    method.startLine,
                    0,
                    method.endLine,
                    0
                );

                test.children.add(testItem);
            }
        } catch (error) {
            console.error(`Error resolving test item ${test.id}:`, error);
        }
    }

    private scheduleRefresh(): void {
        // Clear existing timeout if any
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        // Schedule a new refresh after a short delay
        this.refreshTimeout = setTimeout(() => {
            void this.discoverAllTests();
            this.refreshTimeout = null;
        }, 500);
    }

    private onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
        if (e.document.uri.fsPath.endsWith('.php')) {
            this.scheduleRefresh();
        }
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.fileWatcher?.dispose();
    }
}

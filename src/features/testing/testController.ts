import { TestClass, VIEW_MODE, type CodeceptionYamlConfig } from '@src/core/types/types';
import { CodeceptionCoverageProvider } from '@src/features/coverage/coverageProvider';
import { TestData } from '@src/models/testData';
import { CodeceptConfigReader } from '@src/services/config/CodeceptConfigReader';
import { ConfigurationService } from '@src/services/config/ConfigurationService';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import PhpTestParser from './parser';
import { TestProfileManager } from './TestProfileManager';
import { TestRunner } from './TestRunner';

const sep = path.sep;

export class CodeceptionTestController implements vscode.Disposable {
    private testData         : TestData = new TestData();
    private parser           : PhpTestParser;
    private configReader     : CodeceptConfigReader;
    private fileWatcher      : vscode.FileSystemWatcher | null = null;
    private refreshTimeout   : NodeJS.Timeout | null = null;
    private disposables      : vscode.Disposable[] = [];
    private testController   : vscode.TestController;
    private outputChannel    : vscode.OutputChannel;
    private coverageProvider : CodeceptionCoverageProvider;
    private testRunner       : TestRunner;
    private configService    : ConfigurationService;
    private suiteGroups = new Map<string, vscode.TestItem>();
    private pathGroups = new Map<string, vscode.TestItem>();
    private currentView      : string = VIEW_MODE.SUITES;

    constructor(
        private readonly workspaceFolder: vscode.WorkspaceFolder,
    ) {
        this.testController = vscode.tests.createTestController('codeception', 'Codeception');
        this.configReader = new CodeceptConfigReader(workspaceFolder);
        this.parser = new PhpTestParser();
        this.outputChannel = vscode.window.createOutputChannel('Codeception Tests');
        this.coverageProvider = new CodeceptionCoverageProvider(workspaceFolder);
        this.configService = ConfigurationService.getInstance();
        this.currentView = this.configService.getConfig().viewMode;

        // Initialize services
        this.testRunner = new TestRunner(
            this.testController,
            this.testData,
            workspaceFolder,
            this.outputChannel,
            this.coverageProvider,
        );

        new TestProfileManager(this.testController, this.testRunner);

        this.setupFileWatcher();
        this.registerCommands();

        this.disposables.push(
            this.testController,
            this.outputChannel,
            this.coverageProvider,
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('codeception.viewMode')) {
                    this.currentView = this.configService.getConfig().viewMode;

                    this.updateTestExplorerView();
                }

                if (e.affectsConfiguration('codeception.disableRunningSingleTestCases')) {
                    void this.discoverAllTests();
                }
            }),
        );

        this.testController.resolveHandler = async (test) => test ? await this.resolveTestItem(test) : await this.discoverAllTests();

        this.testController.refreshHandler = () => {
            void this.discoverAllTests();
        };

        // Initialize coverage data if available
        void this.initializeCoverage();
        void this.discoverAllTests();
    }

    private setupFileWatcher() {
        const pattern = this.configService.getConfig().testFilePattern;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceFolder, pattern),
        );

        this.fileWatcher.onDidChange(() => this.scheduleRefresh());
        this.fileWatcher.onDidCreate(() => this.scheduleRefresh());
        this.fileWatcher.onDidDelete(() => this.scheduleRefresh());

        this.disposables.push(this.fileWatcher);
    }

    private async loadTestFiles() {
        try {
            // Get test paths from config files
            const testPaths = await this.configReader.getTestPaths();
            const files = await this.parser.findTestFiles(testPaths);
            const testClasses = await this.parser.parseTestFiles(files);

            // Clear existing tests
            this.testData.clear();
            this.suiteGroups.clear();
            this.pathGroups.clear();

            // Create test items for each class and method
            for (const testClass of testClasses) {
                // Get nearest config file for this test class
                const nearestConfig = await this.configReader.findNearestConfig(testClass.uri.fsPath);

                if (nearestConfig) {
                    testClass.configFile = nearestConfig.path;
                }

                // Find the suite for this test class
                const relativePath = vscode.workspace.asRelativePath(testClass.uri);

                // Get or create suite group
                const testItem = this.createSuiteGrouping(nearestConfig, relativePath, testClass);

                // Add to path groups
                this.createPathGrouping(relativePath, testItem, testClass);
            }

            // Update the view based on current selection
            this.updateTestExplorerView();
        } catch (error) {
            console.error('Error loading test files:', error);
        }
    }

    private createSuiteGrouping(nearestConfig: { config: CodeceptionYamlConfig; path: string; } | null, relativePath: string, testClass: TestClass) {
        const suiteName = this.findSuiteForPath(relativePath, nearestConfig?.config.suites || {});
        let suiteGroup = this.suiteGroups.get(suiteName);

        if (!suiteGroup) {
            suiteGroup = this.testController.createTestItem(
                `suite:${suiteName}`,
                `$(folder) ${suiteName}`,
                undefined,
            );
            this.suiteGroups.set(suiteName, suiteGroup);
        }

        // Create test item
        const testItem = this.createTestItem(testClass);

        // Add to suite group
        suiteGroup.children.add(testItem);

        return testItem;
    }

    private createPathGrouping(relativePath: string, testItem: vscode.TestItem, testClass: TestClass) {
        const pathParts = relativePath.split(sep);
        let currentPath = '';
        let parentGroup: vscode.TestItem | undefined;

        // Create/get groups for each path segment
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            let pathGroup = this.pathGroups.get(currentPath);

            if (!pathGroup) {
                pathGroup = this.testController.createTestItem(
                    `path:${currentPath}`,
                    `$(folder) ${part}`,
                    undefined,
                );
                this.pathGroups.set(currentPath, pathGroup);

                // Add to parent group if exists
                if (parentGroup) {
                    parentGroup.children.add(pathGroup);
                }
            }

            parentGroup = pathGroup;
        }

        // Add test item to its directory group
        if (parentGroup) {
            const linkedItem = this.testController.createTestItem(
                testItem.id,
                testItem.label,
                testItem.uri,
            );
            linkedItem.range = testItem.range;
            linkedItem.canResolveChildren = true;

            // Store test data for path group items
            this.testData.setItem(linkedItem.id, testClass);

            parentGroup.children.add(linkedItem);
        }
    }

    private findSuiteForPath(filePath: string, suites: Record<string, { path?: string }>): string {
        let matchedSuite = 'default';
        let longestMatch = '';

        for (const [suite, { path }] of Object.entries(suites)) {
            if (!path) continue;

            const normalizedPath = path.replace(/^\.\//, '').replace(/\\/g, sep);
            const normalizedFile = filePath.replace(/\\/g, sep);

            if (normalizedFile.startsWith(normalizedPath) && normalizedPath.length > longestMatch.length) {
                longestMatch = normalizedPath;
                matchedSuite = suite;
            }
        }

        return matchedSuite;
    }

    private createTestItem(testClass: TestClass): vscode.TestItem {
        const testItem = this.testController.createTestItem(
            `test:${testClass.fullName}`,
            `$(symbol-class) ${testClass.name}`,
            testClass.uri,
        );

        testItem.canResolveChildren = !this.configService.getConfig().disableRunningSingleTestCases;
        testItem.tags = [...(testClass.tags || [])];
        testItem.range = new vscode.Range(
            testClass.startLine,
            0,
            testClass.endLine,
            0,
        );

        this.testData.setItem(testItem.id, testClass);

        return testItem;
    }

    public async discoverAllTests() {
        try {
            await this.loadTestFiles();
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

            if (this.configService.getConfig().disableRunningSingleTestCases == false) {
                for (const method of testClass.methods) {
                    const testItem = this.testController.createTestItem(
                        `${test.uri.fsPath}:${method.name}`,
                        `$(symbol-method) ${method.name}`,
                        test.uri,
                    );

                    testItem.tags = [...(test.tags || [])];
                    testItem.range = new vscode.Range(
                        method.startLine,
                        0,
                        method.endLine,
                        0,
                    );

                    test.children.add(testItem);
                }
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
    private updateTestExplorerView() {
        if (this.currentView === VIEW_MODE.SUITES) {
            const suiteItems: vscode.TestItem[] = [];
            for (const [id, suite] of this.suiteGroups) {
                const suiteName = suite.label.toString().replace(/^\$\(folder\)\s*/, '');
                const newSuite = this.testController.createTestItem(
                    id,
                    `$(folder) ${suiteName}`,
                    suite.uri,
                );
                const children = new Array<vscode.TestItem>();
                suite.children.forEach((child) => children.push(child));
                newSuite.children.replace(children);
                suiteItems.push(newSuite);
            }
            this.testController.items.replace(suiteItems);
        } else {
            const pathItems: vscode.TestItem[] = [];
            for (const [id, group] of this.pathGroups) {
                const groupPath = id.replace('path:', '');

                if (!groupPath.includes(sep)) {
                    const groupName = group.label.toString().replace(/^\$\(folder\)\s*/, '');
                    const newGroup = this.testController.createTestItem(
                        id,
                        `$(folder) ${groupName}`,
                        group.uri,
                    );
                    const children = new Array<vscode.TestItem>();
                    group.children.forEach((child) => children.push(child));
                    newGroup.children.replace(children);
                    pathItems.push(newGroup);
                }
            }
            this.testController.items.replace(pathItems);
        }
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.fileWatcher?.dispose();
        this.configService.dispose();
    }

    private async initializeCoverage(): Promise<void> {
        try {
            const config = this.configService.getConfig();
            const coverageFile = path.join(
                this.workspaceFolder.uri.fsPath,
                config.coverageXmlFilePath,
            );

            if (fs.existsSync(coverageFile)) {
                // Load coverage data but don't display it
                await this.testRunner.processCoverage(true, false);
            }
        } catch (error) {
            console.error('Error initializing coverage:', error);
        }
    }

    private registerCommands() {
        // Register the Go to File command
        this.disposables.push(
            vscode.commands.registerCommand('codeception.gotoTestFile', async (test?: vscode.TestItem) => {
                if (!test?.uri) {
                    return;
                }

                const testData = this.testData.getItem(test.id);

                if (!testData) {
                    return;
                }

                // Open the file at the test's location
                await vscode.window.showTextDocument(test.uri, {
                    selection: new vscode.Range(testData.startLine, 0, testData.startLine, 0),
                });
            }),
        );
    }
}

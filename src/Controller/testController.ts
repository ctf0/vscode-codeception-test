import * as vscode from 'vscode';
import { CodeceptionCoverageProvider } from '../Coverage/coverageProvider';
import { TestData } from '../Model/testData';
import { CodeceptConfigReader } from '../Service/Config/CodeceptConfigReader';
import { ConfigurationService } from '../Service/Config/ConfigurationService';
import PhpTestParser from '../Service/parser';
import { TestProfileManager } from '../Service/TestProfileManager';
import { TestRunner } from '../Service/TestRunner';
import { TestClass, VIEW_MODE } from '../Service/types';

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

    constructor(private workspaceFolder: vscode.WorkspaceFolder) {
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
            this.workspaceFolder,
            this.outputChannel,
            this.coverageProvider,
        );

        new TestProfileManager(this.testController, this.testRunner);

        this.setupFileWatcher();

        this.disposables.push(
            this.testController,
            this.outputChannel,
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e.document)),
            vscode.workspace.onDidCreateFiles(() => this.scheduleRefresh()),
            vscode.workspace.onDidDeleteFiles(() => this.scheduleRefresh()),
            vscode.workspace.onDidRenameFiles(() => this.scheduleRefresh()),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('codeception.viewMode')) {
                    this.currentView = this.configService.getConfig().viewMode;

                    this.updateTestExplorerView();
                }
            }),
        );

        this.testController.resolveHandler = async (test) => {
            if (!test) {
                await this.discoverAllTests();

                return;
            }
            await this.resolveTestItem(test);
        };

        void this.discoverAllTests();
    }

    private setupFileWatcher() {
        const pattern = this.configService.getConfig().testFilePattern;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceFolder, pattern),
        );

        this.fileWatcher.onDidChange(() => this.loadTestFiles());
        this.fileWatcher.onDidCreate(() => this.loadTestFiles());
        this.fileWatcher.onDidDelete(() => this.loadTestFiles());

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
                const suiteName = this.findSuiteForPath(relativePath, nearestConfig?.config.suites || {});

                // Get or create suite group
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

                // Add to path groups
                const pathParts = relativePath.split('/');
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

            // Update the view based on current selection
            this.updateTestExplorerView();
        } catch (error) {
            console.error('Error loading test files:', error);
        }
    }

    private findSuiteForPath(filePath: string, suites: Record<string, { path?: string }>): string {
        let matchedSuite = 'default';
        let longestMatch = '';

        for (const [suite, { path }] of Object.entries(suites)) {
            if (!path) continue;

            const normalizedPath = path.replace(/^\.\//, '').replace(/\\/g, '/');
            const normalizedFile = filePath.replace(/\\/g, '/');

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

        testItem.canResolveChildren = true;
        testItem.range = new vscode.Range(
            testClass.startLine,
            0,
            testClass.endLine,
            0,
        );

        this.testData.setItem(testItem.id, testClass);

        return testItem;
    }

    private createTestItems(testClass: TestClass) {
        const testItem = this.createTestItem(testClass);

        // Clear existing children
        testItem.children.replace([]);

        for (const method of testClass.methods) {
            const testItemMethod = this.testController.createTestItem(
                `${testClass.uri.fsPath}:${method.name}`,
                `$(symbol-method) ${method.name}`,
                testClass.uri,
            );

            testItemMethod.tags = [...(testItem.tags || [])];
            testItemMethod.range = new vscode.Range(
                method.startLine,
                0,
                method.endLine,
                0,
            );

            testItem.children.add(testItemMethod);
        }
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

    private onDocumentChanged(document: vscode.TextDocument): void {
        if (document.uri.fsPath.endsWith('.php')) {
            this.scheduleRefresh();
        }
    }

    private updateTestExplorerView() {
        if (this.currentView === VIEW_MODE.SUITES) {
            this.testController.items.replace([...this.suiteGroups.values()]);
        } else {
            const topLevelGroups = Array.from(this.pathGroups.values()).filter((group) => {
                const groupPath = group.id.replace('path:', '');

                return !groupPath.includes('/');
            });
            this.testController.items.replace(topLevelGroups);
        }
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.fileWatcher?.dispose();
        this.configService.dispose();
    }
}

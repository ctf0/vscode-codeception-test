import { ExecutionError, type TestStatus } from '@src/core/errors/ExecutionError';
import { TestExecutionOptions } from '@src/core/types/types';
import { buildCommand } from '@src/features/commands/buildCommand';
import { CodeceptionCoverageProvider } from '@src/features/coverage/coverageProvider';
import { TestData } from '@src/models/testData';
import { CodeceptConfigReader } from '@src/services/config/CodeceptConfigReader';
import { ConfigurationService } from '@src/services/config/ConfigurationService';
import { i18n } from '@src/services/i18n/i18n';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TestExecutor } from './TestExecutor';

export class TestRunner {
    private readonly executor      : TestExecutor;
    private readonly configService : ConfigurationService;
    private readonly configReader  : CodeceptConfigReader;

    constructor(
        private readonly testController: vscode.TestController,
        private readonly testData: TestData,
        private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly coverageProvider: CodeceptionCoverageProvider,
    ) {
        this.configService = ConfigurationService.getInstance();
        this.executor = new TestExecutor(workspaceFolder);
        this.configReader = new CodeceptConfigReader(workspaceFolder);
    }

    async runTest(
        request: vscode.TestRunRequest,
        cancellation: vscode.CancellationToken,
        debug = false,
        coverage = false,
    ): Promise<void> {
        const run = this.testController.createTestRun(request);
        const queue: vscode.TestItem[] = [];
        let debuggerWasStarted = false;

        try {
            // If either debug or coverage is enabled, ensure debug session is started
            if (debug || coverage) {
                debuggerWasStarted = await this.ensureDebuggerStarted();
            }

            if (request.include) {
                request.include.forEach((test) => queue.push(test));
            } else {
                // Run all tests
                this.testData.getAllTests().forEach((test) => queue.push(test));
            }

            while (queue.length > 0 && !cancellation.isCancellationRequested) {
                const test = queue.pop()!;

                if (request.exclude?.includes(test)) {
                    continue;
                }

                const testData = this.testData.getTestData(test);

                if (!testData) {
                    run.skipped(test);
                    continue;
                }

                // Start the test and its methods
                run.started(test);

                // If it's a class test, resolve and start all child tests
                if (!testData.method) {
                    await this.testController.resolveHandler?.(test);
                    test.children.forEach((child) => {
                        if (!request.exclude?.includes(child)) {
                            run.started(child);
                        }
                    });
                }

                try {
                    let configFile = testData.configFile;

                    if (!configFile && test.uri) {
                        const nearestConfig = await this.configReader.findNearestConfig(test.uri.fsPath);

                        if (nearestConfig) {
                            configFile = nearestConfig.path;
                        }
                    }

                    const command = buildCommand(
                        this.configService,
                        {
                            className : testData.className,
                            method    : testData.method,
                            configFile,
                        },
                        debug,
                        coverage,
                    );

                    // Show command in output channel
                    this.outputChannel.clear();

                    if (coverage) {
                        this.outputChannel.appendLine('Running Test Command with Coverage (debugger started automatically)');
                    } else if (debug) {
                        this.outputChannel.appendLine('Running Test Command with Debug (debugger started automatically)');
                    } else {
                        this.outputChannel.appendLine('Running Test Command:');
                    }
                    this.outputChannel.appendLine(command);
                    this.outputChannel.appendLine('-------------------');
                    this.outputChannel.show(true);

                    // Start the test to enable output preservation
                    run.started(test);

                    // Add command to test output
                    run.appendOutput(`Running Command: ${command}\r\n-------------------\r\n`, undefined, test);

                    const { stdout, stderr } = await this.executor.executeCommand(command);

                    // Show output
                    if (stdout) {
                        this.outputChannel.appendLine(stdout);
                        stdout.split('\n').forEach((line) => run.appendOutput(`${line}\r\n`, undefined, test));
                    }

                    if (stderr) {
                        this.outputChannel.appendLine(stderr);
                        stderr.split('\n').forEach((line) => run.appendOutput(`${line}\r\n`, undefined, test));
                    }

                    // Process result
                    if (stdout) {
                        const error = new ExecutionError('Test execution', stdout, stderr);
                        const status = error.parseTestStatus();

                        if (status.failed > 0) {
                            this.testFail(run, test, status, testData, request);
                        } else if (status.successful > 0) {
                            if (
                                (status.successful !== test.children.size) && this.configService.getConfig().disableRunningSingleTestCases == false
                            ) {
                                this.testFail(run, test, status, testData, request);
                            } else {
                                this.testPass(run, test, testData, request);
                            }
                        } else if (status.skipped > 0) {
                            this.testSkip(run, test, testData, request);
                        } else {
                            this.testError(run, test, testData, request);
                        }
                    } else {
                        const message = new vscode.TestMessage(stderr || i18n.t('test.noOutput'));
                        run.errored(test, message);

                        if (!testData.method) {
                            test.children.forEach((child) => {
                                if (!request.exclude?.includes(child)) {
                                    run.errored(child, message);
                                }
                            });
                        }
                    }

                    // Process coverage if available
                    if (coverage) {
                        await this.processCoverage(false, true, request);
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    run.failed(test, new vscode.TestMessage(`Error running test: ${message}`));
                }
            }
        } finally {
            // Stop debugger if we started it
            if (debuggerWasStarted) {
                await this.stopDebugger();
            }

            run.end();
        }
    }

    private testError(
        run: vscode.TestRun,
        test: vscode.TestItem,
        testData: TestExecutionOptions,
        request: vscode.TestRunRequest,
    ): void {
        const message = new vscode.TestMessage(i18n.t('test.noResults'));
        run.errored(test, message);

        if (!testData.method) {
            test.children.forEach((child) => {
                if (!request.exclude?.includes(child)) {
                    run.errored(child, message);
                }
            });
        }
    }

    private testSkip(
        run: vscode.TestRun,
        test: vscode.TestItem,
        testData: TestExecutionOptions,
        request: vscode.TestRunRequest,
    ): void {
        run.skipped(test);

        if (!testData.method) {
            test.children.forEach((child) => {
                if (!request.exclude?.includes(child)) {
                    run.skipped(child);
                }
            });
        }
    }

    private testPass(
        run: vscode.TestRun,
        test: vscode.TestItem,
        testData: TestExecutionOptions,
        request: vscode.TestRunRequest,
    ): void {
        // Add coverage data to test result if available
        const testUri = test.uri?.toString();

        if (testUri) {
            const coverageData = this.coverageProvider.getCoverageData();
            const coverage = coverageData.get(testUri);

            if (coverage) {
                const totalLines = coverage.ranges.length;
                const coveredLines = coverage.counts.filter((count: number) => count > 0).length;
                const percentage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
                test.description = i18n.t('coverage.description', percentage);
            }
        }

        run.passed(test);

        if (!testData.method) {
            test.children.forEach((child) => {
                if (!request.exclude?.includes(child)) {
                    run.passed(child);
                }
            });
        }
    }

    private testFail(
        run: vscode.TestRun,
        test: vscode.TestItem,
        status: TestStatus,
        testData: TestExecutionOptions,
        request: vscode.TestRunRequest,
    ): void {
        // Add coverage data to test result if available
        const testUri = test.uri?.toString();

        if (testUri) {
            const coverageData = this.coverageProvider.getCoverageData();
            const coverage = coverageData.get(testUri);

            if (coverage) {
                const totalLines = coverage.ranges.length;
                const coveredLines = coverage.counts.filter((count: number) => count > 0).length;
                const percentage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
                test.description = i18n.t('coverage.description', percentage);
            }
        }

        const message = new vscode.TestMessage(status.message || i18n.t('test.failed'));
        run.failed(test, message);

        if (!testData.method) {
            test.children.forEach((child) => {
                if (!request.exclude?.includes(child)) {
                    run.failed(child, message);
                }
            });
        }
    }

    private async ensureDebuggerStarted(): Promise<boolean> {
        const debugSession = vscode.debug.activeDebugSession;

        if (!debugSession) {
            // Start debug session if not already running
            await vscode.commands.executeCommand('workbench.action.debug.start');
            // Wait a bit for the debugger to initialize
            await new Promise((resolve) => setTimeout(resolve, 2000));

            return true; // We started the debugger
        }

        return false; // Debugger was already running
    }

    private async stopDebugger(): Promise<void> {
        const debugSession = vscode.debug.activeDebugSession;

        if (debugSession) {
            await vscode.commands.executeCommand('workbench.action.debug.stop');
            // Wait a bit for the debugger to stop
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    public async processCoverage(
        isInitialLoad = false,
        showDisplay = false,
        request?: vscode.TestRunRequest,
    ): Promise<void> {
        try {
            const config = this.configService.getConfig();
            const coverageFile = path.join(
                this.workspaceFolder.uri.fsPath,
                config.coverageXmlFilePath,
            );

            if (fs.existsSync(coverageFile)) {
                await this.coverageProvider.loadCoverage(coverageFile, config.pathMapping);

                // Get coverage data for test results
                const coverageData = this.coverageProvider.getCoverageData();

                if (coverageData && showDisplay) {
                    // Create a test run for coverage results using the original request if available
                    const run = this.testController.createTestRun(
                        request || new vscode.TestRunRequest(),
                        isInitialLoad ? i18n.t('coverage.initialLoad') : i18n.t('coverage.results'),
                        false,
                    );

                    for (const [uriString, coverage] of coverageData.entries()) {
                        const totalLines = coverage.ranges.length;
                        const coveredLines = coverage.counts.filter((count) => count > 0).length;
                        const percentage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;

                        // Create VS Code coverage data
                        const fileCoverage = new vscode.FileCoverage(
                            coverage.uri,
                            {
                                covered : coveredLines,
                                total   : totalLines,
                            },
                        );

                        // Add coverage to test run
                        run.addCoverage(fileCoverage);

                        // Update test items with coverage info
                        this.testData.getAllTests().forEach((test) => {
                            if (test.uri?.toString() === uriString) {
                                test.description = i18n.t('coverage.description', percentage);
                                test.tags = [
                                    ...(test.tags || []),
                                    new vscode.TestTag(`coverage-${percentage}`),
                                ];

                                // Add coverage message to test result
                                run.enqueued(test);
                                run.started(test);
                                run.passed(test);
                            }
                        });
                    }

                    run.end();
                }
            } else if (!isInitialLoad && showDisplay) {
                // Only show warning if not during initial load and display is requested
                const message = i18n.t('coverage.fileNotFound', coverageFile);
                this.outputChannel.appendLine(message);
                vscode.window.showWarningMessage(message);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(i18n.t('coverage.processError'), message);

            if (!isInitialLoad && showDisplay) {
                // Only show error if not during initial load and display is requested
                const errorMessage = i18n.t('coverage.processError', message);
                this.outputChannel.appendLine(errorMessage);
                vscode.window.showErrorMessage(errorMessage);
            }
        }
    }
}

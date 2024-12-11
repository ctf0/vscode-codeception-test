import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildCommand } from '../Commands/buildCommand';
import { CodeceptionCoverageProvider } from '../Coverage/coverageProvider';
import { TestData } from '../Model/testData';
import { ExecutionError } from '../Util/ExecutionError';
import { CodeceptConfigReader } from './Config/CodeceptConfigReader';
import { ConfigurationService } from './Config/ConfigurationService';
import { TestExecutor } from './TestExecutor';

interface TestRunOptions {
    debug?: boolean;
    coverage?: boolean;
}

export class TestRunner {
    private readonly executor: TestExecutor;
    private readonly configService: ConfigurationService;
    private readonly configReader: CodeceptConfigReader;

    constructor(
        private readonly testController: vscode.TestController,
        private readonly testData: TestData,
        private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly coverageProvider: CodeceptionCoverageProvider,
    ) {
        this.configService = ConfigurationService.getInstance();
        this.executor = new TestExecutor(workspaceFolder, this.configService);
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
                            className: testData.className,
                            method: testData.method,
                            configFile,
                        },
                        debug,
                        coverage
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

                    const { stdout, stderr } = await this.executor.executeCommand(command);

                    // Show output
                    if (stdout) {
                        this.outputChannel.appendLine(stdout);
                    }

                    if (stderr) {
                        this.outputChannel.appendLine(stderr);
                    }

                    // Process result
                    if (stdout) {
                        const error = new ExecutionError('Test execution', stdout, stderr);
                        const status = error.parseTestStatus();

                        if (status.failed > 0) {
                            run.failed(test, new vscode.TestMessage(`${status.failed} test(s) failed`));

                            if (!testData.method) {
                                test.children.forEach((child) => {
                                    if (!request.exclude?.includes(child)) {
                                        run.failed(child, new vscode.TestMessage('Class test failed'));
                                    }
                                });
                            }
                        } else if (status.successful > 0) {
                            run.passed(test);

                            if (!testData.method) {
                                test.children.forEach((child) => {
                                    if (!request.exclude?.includes(child)) {
                                        run.passed(child);
                                    }
                                });
                            }
                        } else if (status.skipped > 0) {
                            run.skipped(test);

                            if (!testData.method) {
                                test.children.forEach((child) => {
                                    if (!request.exclude?.includes(child)) {
                                        run.skipped(child);
                                    }
                                });
                            }
                        } else {
                            const message = new vscode.TestMessage('No test results found');
                            run.errored(test, message);

                            if (!testData.method) {
                                test.children.forEach((child) => {
                                    if (!request.exclude?.includes(child)) {
                                        run.errored(child, message);
                                    }
                                });
                            }
                        }
                    } else {
                        const message = new vscode.TestMessage(stderr || 'No output from test execution');
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
                        await this.processCoverage();
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

    private async ensureDebuggerStarted(): Promise<boolean> {
        const debugSession = vscode.debug.activeDebugSession;
        if (!debugSession) {
            // Start debug session if not already running
            await vscode.commands.executeCommand('workbench.action.debug.start');
            // Wait a bit for the debugger to initialize
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true; // We started the debugger
        }
        return false; // Debugger was already running
    }

    private async stopDebugger(): Promise<void> {
        const debugSession = vscode.debug.activeDebugSession;
        if (debugSession) {
            await vscode.commands.executeCommand('workbench.action.debug.stop');
            // Wait a bit for the debugger to stop
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    private async processCoverage(): Promise<void> {
        try {
            const config = this.configService.getConfig();
            const coverageFile = path.join(
                this.workspaceFolder.uri.fsPath,
                config.coverageXmlFilePath,
            );

            if (fs.existsSync(coverageFile)) {
                await this.coverageProvider.loadCoverage(coverageFile, config.pathMapping);
            }
        } catch (error) {
            console.error('Error processing coverage:', error);
        }
    }
}

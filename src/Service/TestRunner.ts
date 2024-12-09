import * as vscode from 'vscode';
import { buildCommand } from '../Commands/buildCommand';
import { getConfiguration } from '../Config/config';
import { CodeceptionCoverageProvider } from '../Coverage/coverageProvider';
import { TestData } from '../Model/testData';
import { TestExecutor } from './TestExecutor';
import * as path from 'path';
import * as fs from 'fs';

export class TestRunner {
    private readonly executor: TestExecutor;

    constructor(
        private readonly testController: vscode.TestController,
        private readonly testData: TestData,
        private readonly workspaceFolder: vscode.WorkspaceFolder,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly coverageProvider: CodeceptionCoverageProvider
    ) {
        this.executor = new TestExecutor(workspaceFolder);
    }

    async runTest(
        request: vscode.TestRunRequest,
        cancellation: vscode.CancellationToken,
        debug = false,
        coverage = false
    ): Promise<void> {
        const run = this.testController.createTestRun(request);
        const queue: vscode.TestItem[] = [];

        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            // Run all tests
            this.testData.getAllTests().forEach(test => queue.push(test));
        }

        while (queue.length > 0 && !cancellation.isCancellationRequested) {
            const test = queue.pop()!;

            if (request.exclude?.includes(test)) {
                continue;
            }

            const data = this.testData.getTestData(test);
            if (!data) {
                run.skipped(test);
                continue;
            }

            try {
                await this.runSingleTest(test, data, run, debug, coverage);
            } catch (err) {
                run.failed(test, new vscode.TestMessage(`Failed to run test: ${err}`));
            }
        }

        run.end();
    }

    private async runSingleTest(
        test: vscode.TestItem,
        data: { className: string; method?: string; configFile?: string },
        run: vscode.TestRun,
        debug = false,
        coverage = false
    ): Promise<void> {
        run.started(test);

        try {
            const command = buildCommand(
                this.workspaceFolder,
                data,
                debug,
                coverage
            );

            // Show command in output channel
            this.outputChannel.clear();
            if (coverage) {
                this.outputChannel.appendLine('Running Test Command with Coverage: (make sure your debugger is running)');
            } else if (debug) {
                this.outputChannel.appendLine('Running Test Command with Debug: (make sure your debugger is running)');
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
            if (stderr) {
                run.failed(test, new vscode.TestMessage(stderr));
                if (test.parent) {
                    run.failed(test.parent, new vscode.TestMessage(stderr));
                }
            } else {
                run.passed(test);
                if (test.parent) {
                    run.passed(test.parent);
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

    private async processCoverage(): Promise<void> {
        try {
            const config = getConfiguration();
            const coverageFile = path.join(
                this.workspaceFolder.uri.fsPath,
                config.coverageXmlFilePath
            );

            if (fs.existsSync(coverageFile)) {
                await this.coverageProvider.loadCoverage(coverageFile, config.pathMapping, this.workspaceFolder);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.outputChannel.appendLine(`Failed to process coverage: ${message}`);
            vscode.window.showWarningMessage(`Failed to process coverage: ${message}`);
        }
    }
}

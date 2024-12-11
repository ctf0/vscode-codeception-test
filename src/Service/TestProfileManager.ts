import * as vscode from 'vscode';
import { TestRunner } from './TestRunner';

export class TestProfileManager {
    constructor(
        private readonly testController: vscode.TestController,
        private readonly testRunner: TestRunner,
    ) {
        this.setupProfiles();
    }

    private setupProfiles(): void {
        // Create run profile for running tests
        this.testController.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            async (request, token) => {
                await this.testRunner.runTest(request, token);
            },
            true,
            undefined,
            true,
        );

        // Create run profile for debugging tests
        this.testController.createRunProfile(
            'Debug',
            vscode.TestRunProfileKind.Debug,
            async (request, token) => {
                await this.testRunner.runTest(request, token, true);
            },
            true,
            undefined,
            true,
        );

        // Create run profile for coverage tests
        this.testController.createRunProfile(
            'Coverage',
            vscode.TestRunProfileKind.Coverage,
            async (request, token) => {
                await this.testRunner.runTest(request, token, false, true);
            },
            true,
            undefined,
            true,
        );
    }
}

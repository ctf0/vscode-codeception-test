import * as vscode from 'vscode';
import { TestRunner } from './TestRunner';

export class TestProfileManager {
    constructor(
        private readonly testController: vscode.TestController,
        private readonly testRunner: TestRunner,
    ) {
        // Run Profile
        this.testController.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.testRunner.runTest(request, token),
            true,
        );

        // Debug Profile
        this.testController.createRunProfile(
            'Debug',
            vscode.TestRunProfileKind.Debug,
            (request, token) => this.testRunner.runTest(request, token, true),
            true,
        );

        // Coverage Profile
        this.testController.createRunProfile(
            'Coverage',
            vscode.TestRunProfileKind.Coverage,
            (request, token) => this.testRunner.runTest(request, token, false, true),
            true,
        );
    }
}

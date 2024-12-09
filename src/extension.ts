// extension.ts
import * as vscode from 'vscode';
import { CodeceptionTestController } from './Controller/testController';

let testController: CodeceptionTestController | undefined;

export function activate(_context: vscode.ExtensionContext) {
    // Get the first workspace folder
    const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    // Create the test controller
    testController = new CodeceptionTestController(workspaceFolder);
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
}

// extension.ts
import * as vscode from 'vscode';
import { CodeceptionTestController } from './Controller/testController';
let testController: CodeceptionTestController | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');

        return;
    }

    testController = new CodeceptionTestController(workspaceFolder);
    context.subscriptions.push(testController);
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
}

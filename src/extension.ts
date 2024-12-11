// extension.ts
import * as vscode from 'vscode';
import { CodeceptionTestController } from './Controller/testController';
import { ConfigurationService } from './Service/Config/ConfigurationService';

let testController: CodeceptionTestController | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    for (const workspaceFolder of workspaceFolders) {
        testController = new CodeceptionTestController(workspaceFolder);
        context.subscriptions.push(testController);
    }
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
    ConfigurationService.getInstance().dispose();
}

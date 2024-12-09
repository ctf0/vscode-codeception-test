// extension.ts
import * as vscode from 'vscode';
import { CodeceptionTestController } from './features/testing/testController';

export function activate(context: vscode.ExtensionContext): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return;
    }

    // Create test controller for each workspace folder
    for (const workspaceFolder of workspaceFolders) {
        const controller = new CodeceptionTestController(workspaceFolder);
        context.subscriptions.push(controller);
    }
}

export function deactivate(): void {
    // Clean up if needed
}

import * as vscode from 'vscode';
import { CodeceptionConfig } from '../Service/types';

export function getConfiguration(): CodeceptionConfig {
    const config = vscode.workspace.getConfiguration('codeception');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let codeceptPath = config.get<string>('codecept', 'vendor/bin/codecept');

    // Replace ${workspaceFolder} with actual workspace path if it exists
    if (workspaceFolder && codeceptPath.includes('${workspaceFolder}')) {
        codeceptPath = codeceptPath.replace('${workspaceFolder}', workspaceFolder);
    }

    return {
        testFilePattern: config.get<string>('testFilePattern', ''),
        codecept: codeceptPath,
        additionalArgs: config.get<string[]>('args.additional', []),
        debugArgs: config.get<string[]>('args.debug', []),
        coverageArgs: config.get<string[]>('args.coverage', []),
        runArgs: config.get<string[]>('args.run', []),
        command: config.get<string>('command.default', ''),
        debugCommand: config.get<string>('command.debug', ''),
        envVars: config.get<Record<string, string>>('env', {}),
        coverageHtmlFilePath: config.get<string>('coverage.htmlFilePath', ''),
        coverageXmlFilePath: config.get<string>('coverage.xmlFilePath', ''),
        pathMapping: config.get<Record<string, string>>('pathMapping', {})
    };
}

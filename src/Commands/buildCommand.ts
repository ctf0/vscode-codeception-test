import type * as vscode from 'vscode';
import { getConfiguration } from '../Config/config';
import type { TestCommandData } from '../Service/types';

export function buildCommand(
    workspaceFolder: vscode.WorkspaceFolder,
    data: TestCommandData,
    debug = false,
    coverage = false
): string {
    const config = getConfiguration();
    const args: string[] = [];

    // Replace ${workspaceFolder} in command with actual path
    let command = config.command.replace(/\${workspaceFolder}/g, workspaceFolder.uri.fsPath);
    let debugCommand = config.debugCommand.replace(/\${workspaceFolder}/g, workspaceFolder.uri.fsPath);

    const additionalArgs = config.additionalArgs;

    args.push(config.codecept);
    args.push('run');

    // Add run arguments
    if (config.runArgs.length > 0) {
        args.push(...config.runArgs);
    }

    // Add test class
    if (data.className) {
        // Add method if specified
        if (data.method) {
            args.push(`${data.className}:${data.method}`);
        } else {
            args.push(data.className);
        }
    }

    // Add debug args if needed
    if (debug) {
        args.push(...config.debugArgs);
    }

    // Add coverage args if needed
    if (coverage) {
        args.push(...config.coverageArgs);
    }

    // Add additional arguments
    if (additionalArgs.length > 0) {
        args.push(...additionalArgs);
    }

    // Add config file if specified
    if (data.configFile && !additionalArgs.includes('-c') && !additionalArgs.includes('--config')) {
        args.push('-c', data.configFile);
    }

    // Format environment variables
    const envVars = Object.entries(config.envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

    const cmnd = `${(debug || coverage) ? debugCommand : command} ${args.join(' ')}`;

    return envVars
        ? `${envVars} ${cmnd}`
        : `${cmnd}`;
}

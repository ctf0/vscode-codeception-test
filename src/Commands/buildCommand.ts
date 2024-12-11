import * as path from 'path';
import type * as vscode from 'vscode';
import { ConfigurationService } from '../Service/Config/ConfigurationService';
import { PathResolver } from '../Service/Environment/PathResolver';
import type { TestCommandData } from '../Service/types';

export function buildCommand(
    configService: ConfigurationService,
    data: TestCommandData,
    debug = false,
    coverage = false,
): string {
    const config = configService.getConfig();
    const pathResolver = PathResolver.getInstance();

    if (!config.codecept) {
        throw new Error('Codecept command is not configured');
    }

    // Always use debug command when coverage is enabled
    const useDebugCommand = debug || coverage;
    const baseCommand = useDebugCommand ? config.debugCommand : config.command;
    if (!baseCommand) {
        throw new Error(`${useDebugCommand ? 'Debug' : 'Run'} command is not configured`);
    }

    const args = [
        config.codecept,
        'run',
        ...sanitizeArgs(config.runArgs),
        ...(data.className ? [
            data.method ? `${data.className}:${data.method}` : data.className
        ] : []),
        // Add debug args if either debug mode or coverage is enabled
        ...(useDebugCommand ? sanitizeArgs(config.debugArgs) : []),
        ...(coverage ? sanitizeArgs(config.coverageArgs) : []),
        ...sanitizeArgs(config.additionalArgs),
        ...(data.configFile ? [
            '-c',
            path.relative(pathResolver.getWorkspaceFolder()?.uri.fsPath || '', data.configFile)
        ] : [])
    ].filter(Boolean);

    return `${pathResolver.resolvePath(baseCommand)} ${args.join(' ')}`;
}

function sanitizeArgs(args: string[] | undefined): string[] {
    if (!Array.isArray(args)) return [];
    return args.filter(arg => typeof arg === 'string' && arg.trim().length > 0)
        .map(arg => arg.trim());
}

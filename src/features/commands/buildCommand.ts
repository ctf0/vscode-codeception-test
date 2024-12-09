import * as vscode from 'vscode';
import { ConfigurationService } from '@src/services/config/ConfigurationService';
import { PathResolver } from '@src/core/environment/PathResolver';
import { i18n } from '@src/services/i18n/i18n';
import type { TestCommandData } from '@src/core/types/types';

export function buildCommand(
    configService: ConfigurationService,
    data: TestCommandData,
    debug = false,
    coverage = false,
): string {
    const config = configService.getConfig();
    const pathResolver = PathResolver.getInstance();

    if (!config.codecept) {
        throw new Error(i18n.t('command.noCodeceptConfig'));
    }

    // Always use debug command when coverage is enabled
    const useDebugCommand = debug || coverage;
    const baseCommand = useDebugCommand ? config.debugCommand : config.command;

    if (!baseCommand) {
        throw new Error(i18n.t('command.noRunConfig', useDebugCommand ? 'Debug' : 'Run'));
    }

    const args = [
        config.codecept,
        'run',
        // Add debug args if either debug mode or coverage is enabled
        ...(useDebugCommand ? sanitizeArgs(config.debugArgs) : []),
        ...(coverage ? sanitizeArgs(config.coverageArgs) : []),
        ...sanitizeArgs(config.additionalArgs),
        ...(data.configFile
            ? [
                '-c',
                vscode.workspace.asRelativePath(data.configFile),
            ]
            : []),
        ...sanitizeArgs(config.runArgs),
        ...(data.className
            ? [
                data.method ? `${data.className}:${data.method}` : data.className,
            ]
            : []),
    ].filter(Boolean);

    return `${pathResolver.resolvePath(baseCommand)} ${args.join(' ')}`;
}

function sanitizeArgs(args: string[] | undefined): string[] {
    if (!Array.isArray(args)) return [];

    return args.filter((arg) => typeof arg === 'string' && arg.trim().length > 0)
        .map((arg) => arg.trim());
}

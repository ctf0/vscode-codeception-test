import * as vscode from 'vscode';
import { CodeceptionConfig } from '../types';

export class ConfigurationService {
    private static instance: ConfigurationService;
    private config: CodeceptionConfig;

    private constructor() {
        this.config = this.loadConfiguration();
    }

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    public getConfig(): CodeceptionConfig {
        return this.config;
    }

    public reload(): void {
        this.config = this.loadConfiguration();
    }

    private loadConfiguration(): CodeceptionConfig {
        const config = vscode.workspace.getConfiguration('codeception');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let codeceptPath = config.get<string>('codecept', 'vendor/bin/codecept');

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
}

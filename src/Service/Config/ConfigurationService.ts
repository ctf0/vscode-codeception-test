import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';

export class ConfigurationService implements vscode.Disposable {
    private static instance: ConfigurationService;
    private config: ExtensionConfig;
    private disposables: vscode.Disposable[] = [];
    private readonly configSection = 'codeception';

    private constructor() {
        this.config = this.loadConfiguration();
        this.setupConfigWatcher();
    }

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }

        return ConfigurationService.instance;
    }

    public getConfig(): ExtensionConfig {
        return this.config;
    }

    public reload(): void {
        this.config = this.loadConfiguration();
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }

    public get<T>(section: string, defaultValue?: T): T {
        return vscode.workspace.getConfiguration(this.configSection).get<T>(section, defaultValue as T);
    }

    private setupConfigWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(this.configSection)) {
                this.reload();
            }
        });
        this.disposables.push(configWatcher);
    }

    private loadConfiguration(): ExtensionConfig {
        return {
            testFilePattern: this.get<string>('testFilePattern', ''),
            configFilePattern: this.get<string>('configFilePattern', ''),
            codecept: this.get<string>('codecept', ''),
            additionalArgs: this.get<string[]>('args.additional', []),
            debugArgs: this.get<string[]>('args.debug', []),
            coverageArgs: this.get<string[]>('args.coverage', []),
            runArgs: this.get<string[]>('args.run', []),
            command: this.get<string>('command.default', ''),
            debugCommand: this.get<string>('command.debug', ''),
            coverageHtmlFilePath: this.get<string>('coverage.htmlFilePath', ''),
            coverageXmlFilePath: this.get<string>('coverage.xmlFilePath', ''),
            viewMode: this.get<string>('viewMode', ''),
            useNearestConfigFile: this.get<boolean>('useNearestConfigFile', false),
            pathMapping: this.get<Record<string, string>>('pathMapping', {}),
        };
    }
}

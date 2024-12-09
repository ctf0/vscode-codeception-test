import { ExtensionConfig, VIEW_MODE } from '@src/core/types/types';
import * as vscode from 'vscode';

export class ConfigurationService implements vscode.Disposable {
    private static instance : ConfigurationService;
    private config          : ExtensionConfig;
    private disposables     : vscode.Disposable[] = [];
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
            additionalArgs                : this.get<string[]>('args.additional', []),
            codecept                      : this.get<string>('codecept', ''),
            command                       : this.get<string>('command.default', ''),
            configFilePattern             : this.get<string>('pattern.configFile', ''),
            coverageArgs                  : this.get<string[]>('args.coverage', []),
            coverageHtmlFilePath          : this.get<string>('coverage.htmlFilePath', ''),
            coverageXmlFilePath           : this.get<string>('coverage.xmlFilePath', ''),
            debugArgs                     : this.get<string[]>('args.debug', []),
            debugCommand                  : this.get<string>('command.debug', ''),
            pathMapping                   : this.get<Record<string, string>>('pathMapping', {}),
            runArgs                       : this.get<string[]>('args.run', []),
            testFilePattern               : this.get<string>('pattern.testFile', ''),
            useNearestConfigFile          : this.get<boolean>('useNearestConfigFile', false),
            disableRunningSingleTestCases : this.get<boolean>('disableRunningSingleTestCases', false),
            viewMode                      : this.get<string>('viewMode', '') as VIEW_MODE,
        };
    }
}

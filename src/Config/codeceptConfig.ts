import * as fs from 'fs';
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import { findUp } from 'find-up';
import { CodeceptionConfigFile } from '../Service/types';

export interface CodeceptConfig {
    paths?: {
        tests?: string;
        output?: string;
        data?: string;
        support?: string;
    };
    suites?: {
        [key: string]: {
            path: string;
            class_name?: string;
        };
    };
    settings?: {
        coverage?: {
            enabled?: boolean;
            report?: {
                html?: string;
            };
        };
    };
}

export class CodeceptConfigReader {
    private workspaceFolder: vscode.WorkspaceFolder;
    private configCache: Map<string, CodeceptConfig> = new Map();
    private configWatcher: vscode.FileSystemWatcher | null = null;

    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        this.workspaceFolder = workspaceFolder;
        this.setupConfigWatcher();
    }

    private setupConfigWatcher() {
        // Watch for changes in any codeception*.yml or codeception*.yaml files
        this.configWatcher?.dispose();
        this.configWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceFolder, '**/codeception*.{yml,yaml}')
        );

        this.configWatcher.onDidChange((uri) => this.clearCache(uri.fsPath));
        this.configWatcher.onDidCreate((uri) => this.clearCache(uri.fsPath));
        this.configWatcher.onDidDelete((uri) => this.clearCache(uri.fsPath));
    }

    private clearCache(configPath?: string) {
        if (configPath) {
            this.configCache.delete(configPath);
        } else {
            this.configCache.clear();
        }
    }

    public dispose() {
        this.configWatcher?.dispose();
    }

    private async findConfigFiles(): Promise<string[]> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(this.workspaceFolder, '**/codeception*.{yml,yaml}'),
            '**/vendor/**'
        );
        
        // Sort to ensure consistent order and put main codeception.yml first
        return files
            .map(f => f.fsPath)
            .sort((a, b) => {
                const aBase = a.split('/').pop()!;
                const bBase = b.split('/').pop()!;
                
                // Main codeception.yml/yaml files should come first
                if (aBase.match(/^codeception\.(yml|yaml)$/)) return -1;
                if (bBase.match(/^codeception\.(yml|yaml)$/)) return 1;
                
                return aBase.localeCompare(bBase);
            });
    }

    private async parseConfigFile(configPath: string): Promise<CodeceptConfig | undefined> {
        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            return YAML.parse(content);
        } catch (error) {
            console.error(`Error reading codeception config at ${configPath}:`, error);
            return undefined;
        }
    }

    public async findNearestConfig(testFilePath: string): Promise<{ config: CodeceptConfig; path: string } | null> {
        try {
            const useNearestConfig = vscode.workspace.getConfiguration('codeception').get<boolean>('useNearestConfigFile', false);
            let configPath: string | undefined;

            if (useNearestConfig) {
                configPath = await findUp(Object.values(CodeceptionConfigFile), {
                    cwd: testFilePath,
                    stopAt: this.workspaceFolder.uri.fsPath
                });
            } else {
                // Try to find config file in workspace root
                for (const configFile of Object.values(CodeceptionConfigFile)) {
                    const rootConfigPath = vscode.Uri.joinPath(this.workspaceFolder.uri, configFile).fsPath;
                    if (fs.existsSync(rootConfigPath)) {
                        configPath = rootConfigPath;
                        break;
                    }
                }
            }

            if (!configPath) {
                return null;
            }

            // Get cached config or parse new one
            let config = this.configCache.get(configPath);
            if (!config) {
                config = await this.parseConfigFile(configPath);
                if (config) {
                    this.configCache.set(configPath, config);
                }
            }

            return config ? { config, path: configPath } : null;
        } catch (error) {
            console.error('Error finding nearest config:', error);
            return null;
        }
    }

    public async getConfig(): Promise<CodeceptConfig | null> {
        // Get main codeception.yml first
        const configFiles = await this.findConfigFiles();
        if (configFiles.length === 0) {
            return null;
        }

        // Merge all configs, with later ones overriding earlier ones
        const mergedConfig: CodeceptConfig = {};
        
        for (const configPath of configFiles) {
            let config = this.configCache.get(configPath);
            
            if (!config) {
                config = await this.parseConfigFile(configPath);
                if (config) {
                    this.configCache.set(configPath, config);
                }
            }

            if (config) {
                this.mergeConfigs(mergedConfig, config);
            }
        }

        return Object.keys(mergedConfig).length > 0 ? mergedConfig : null;
    }

    private mergeConfigs(target: CodeceptConfig, source: CodeceptConfig) {
        // Merge paths
        if (source.paths) {
            target.paths = { ...target.paths, ...source.paths };
        }

        // Merge suites
        if (source.suites) {
            target.suites = { ...target.suites, ...source.suites };
        }

        // Merge settings
        if (source.settings) {
            if (!target.settings) {
                target.settings = {};
            }
            
            target.settings = {
                ...target.settings,
                ...source.settings
            };

            if (source.settings.coverage) {
                if (!target.settings.coverage) {
                    target.settings.coverage = {};
                }

                target.settings.coverage = {
                    ...target.settings.coverage,
                    ...source.settings.coverage
                };

                if (source.settings.coverage.report) {
                    if (!target.settings.coverage.report) {
                        target.settings.coverage.report = {};
                    }

                    target.settings.coverage.report = {
                        ...target.settings.coverage.report,
                        ...source.settings.coverage.report
                    };
                }
            }
        }
    }

    public async getTestPaths(): Promise<string[]> {
        const paths = new Set<string>();
        const configFiles = await this.findConfigFiles();

        for (const configPath of configFiles) {
            let config = this.configCache.get(configPath);
            
            if (!config) {
                config = await this.parseConfigFile(configPath);
                if (config) {
                    this.configCache.set(configPath, config);
                }
            }

            // Add test path from config if it exists
            if (config?.paths?.tests) {
                paths.add(config.paths.tests);
            }

            // Also add paths from suites if they exist
            if (config?.suites) {
                for (const suite of Object.values(config.suites)) {
                    if (suite.path) {
                        paths.add(suite.path);
                    }
                }
            }
        }

        // Return unique paths or fallback to 'tests'
        return paths.size > 0 ? Array.from(paths) : ['tests'];
    }
}

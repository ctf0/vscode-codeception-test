import { CodeceptionConfigFile, CodeceptionYamlConfig } from '@src/core/types/types';
import { findUp } from 'find-up';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { ConfigurationService } from './ConfigurationService';

const sep = path.sep;

/**
 * Reads and parses Codeception YAML configuration files
 */
export class CodeceptConfigReader implements vscode.Disposable {
    private configCache = new Map<string, CodeceptionYamlConfig>();
    private configWatcher          : vscode.FileSystemWatcher | undefined;
    private readonly configService : ConfigurationService;

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {
        this.configService = ConfigurationService.getInstance();
        this.setupConfigWatcher();
    }

    /**
     * Finds all Codeception configuration files in the workspace
     */
    public async findConfigFiles(): Promise<string[]> {
        const configFilePattern = this.configService.getConfig().configFilePattern;
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(this.workspaceFolder, configFilePattern),
            '**/vendor/**',
        );

        // Sort to ensure consistent order and put main codeception.yml first
        return files
            .map((f) => f.fsPath)
            .sort((a, b) => {
                const aBase = a.split(sep).pop()!;
                const bBase = b.split(sep).pop()!;

                // Main codeception.yml/yaml files should come first
                if (aBase.match(/^codeception\.(yml|yaml)$/)) return -1;

                if (bBase.match(/^codeception\.(yml|yaml)$/)) return 1;

                return aBase.localeCompare(bBase);
            });
    }

    /**
     * Finds the nearest Codeception configuration file to a test file
     */
    public async findNearestConfig(testFilePath: string): Promise<{ config: CodeceptionYamlConfig; path: string } | null> {
        try {
            const useNearestConfig = this.configService.getConfig().useNearestConfigFile;
            let configPath: string | undefined;

            if (useNearestConfig) {
                configPath = await findUp(Object.values(CodeceptionConfigFile), {
                    cwd    : testFilePath,
                    stopAt : this.workspaceFolder.uri.fsPath,
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

            const config = await this.getOrLoadConfig(configPath);

            return config ? { config, path: configPath } : null;
        } catch (error) {
            console.error('Error finding nearest config:', error);

            return null;
        }
    }

    /**
     * Gets all test paths from all configuration files
     */
    public async getTestPaths(): Promise<string[]> {
        const paths = new Set<string>();
        const configFiles = await this.findConfigFiles();

        for (const configPath of configFiles) {
            const config = await this.getOrLoadConfig(configPath);

            if (!config) continue;

            // Add test path from config if it exists
            if (config.paths?.tests) {
                paths.add(config.paths.tests);
            }

            // Also add paths from suites if they exist
            if (config.suites) {
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

    /**
     * Gets or loads a configuration from cache
     */
    private async getOrLoadConfig(configPath: string): Promise<CodeceptionYamlConfig | undefined> {
        let config = this.configCache.get(configPath);

        if (!config) {
            config = await this.parseConfigFile(configPath);

            if (config) {
                this.configCache.set(configPath, config);
            }
        }

        return config;
    }

    /**
     * Parses a Codeception YAML configuration file
     */
    private async parseConfigFile(configPath: string): Promise<CodeceptionYamlConfig | undefined> {
        try {
            const content = await fs.promises.readFile(configPath, 'utf8');

            return yaml.parse(content);
        } catch (error) {
            console.error(`Error reading codeception config at ${configPath}:`, error);

            return undefined;
        }
    }

    /**
     * Sets up file watcher for configuration files
     */
    private setupConfigWatcher(): void {
        this.configWatcher?.dispose();
        const configFilePattern = this.configService.getConfig().configFilePattern;
        this.configWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceFolder, configFilePattern),
        );

        this.configWatcher.onDidChange((uri) => this.clearCache(uri.fsPath));
        this.configWatcher.onDidCreate((uri) => this.clearCache(uri.fsPath));
        this.configWatcher.onDidDelete((uri) => this.clearCache(uri.fsPath));
    }

    /**
     * Clears the configuration cache
     */
    private clearCache(configPath?: string): void {
        if (configPath) {
            this.configCache.delete(configPath);
        } else {
            this.configCache.clear();
        }
    }

    public dispose(): void {
        this.configWatcher?.dispose();
        this.configCache.clear();
    }
}

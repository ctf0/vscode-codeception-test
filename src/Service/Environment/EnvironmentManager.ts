import { ExtensionConfig } from '../types';

export class EnvironmentManager {
    constructor(private readonly config: ExtensionConfig) { }

    public getEnvironment(): Record<string, string> {
        return {
            PATH: process.env.PATH || '',
            // Add any other environment variables needed for Codeception
        };
    }
}

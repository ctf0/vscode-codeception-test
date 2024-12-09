import { CodeceptionConfig } from '../types';

export interface EnvironmentVariables {
    [key: string]: string | undefined;
}

export class EnvironmentManager {
    private readonly defaultEnvVars: EnvironmentVariables = {
        XDEBUG_MODE: 'coverage'
    };

    constructor(private config: CodeceptionConfig) {}

    public getEnvironmentVariables(): EnvironmentVariables {
        return {
            ...process.env,
            ...this.defaultEnvVars,
            ...this.config.envVars
        };
    }

    public getCoverageEnvironment(): EnvironmentVariables {
        const env = this.getEnvironmentVariables();
        return {
            ...env,
            XDEBUG_MODE: env.XDEBUG_MODE || this.defaultEnvVars.XDEBUG_MODE
        };
    }
}


export class EnvironmentManager {
    constructor() { }

    public getEnvironment(): Record<string, string> {
        return {
            PATH: process.env.PATH || '',
            // Add any other environment variables needed for Codeception
        };
    }
}

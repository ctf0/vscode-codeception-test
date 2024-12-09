import { ExecaError } from 'execa';

export interface TestStatus {
    successful : number;
    failed     : number;
    skipped    : number;
    incomplete : number;
    useless    : number;
    message?   : string;
}

export class ExecutionError extends Error {
    constructor(
        message: string,
        public readonly stdout: string = '',
        public readonly stderr: string = '',
        public readonly command?: string,
        public readonly exitCode?: number,
    ) {
        super(message);
        this.name = 'ExecutionError';
    }

    public static fromError(error: unknown, command?: string): ExecutionError {
        if (error instanceof ExecutionError) {
            return error;
        }

        if (this.isExecaError(error)) {
            return new ExecutionError(
                error.message,
                error.stdout?.toString() || '',
                error.stderr?.toString() || '',
                command,
                error.exitCode,
            );
        }

        if (error instanceof Error) {
            return new ExecutionError(error.message, '', '', command);
        }

        return new ExecutionError(String(error), '', '', command);
    }

    private static isExecaError(error: unknown): error is ExecaError {
        return (
            error instanceof Error &&
            'stdout' in error &&
            'stderr' in error &&
            'exitCode' in error
        );
    }

    public parseTestStatus(): TestStatus {
        const defaultStatus = {
            successful : 0,
            failed     : 0,
            skipped    : 0,
            incomplete : 0,
            useless    : 0,
        };

        // Find the line containing test results
        const resultLine = this.stdout.split('\n').find((line) => line.includes('Successful:'));

        if (!resultLine) {
            return defaultStatus;
        }

        // Parse numbers from the result line
        const matches = resultLine.match(/Successful: (\d+)\. Failed: (\d+)\. Incomplete: (\d+)\. Skipped: (\d+)\. Useless: (\d+)/);

        if (!matches) {
            return defaultStatus;
        }

        return {
            successful : parseInt(matches[1]) || 0,
            failed     : parseInt(matches[2]) || 0,
            incomplete : parseInt(matches[3]) || 0,
            skipped    : parseInt(matches[4]) || 0,
            useless    : parseInt(matches[5]) || 0,
        };
    }
}

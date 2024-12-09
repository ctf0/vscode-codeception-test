import { ExecaError } from 'execa';

export class ExecutionError extends Error {
    constructor(
        message: string,
        public readonly stdout: string = '',
        public readonly stderr: string = '',
        public readonly command?: string,
        public readonly exitCode?: number
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
                error.exitCode
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

    public isTestFailure(): boolean {
        return (
            this.stderr.includes('XDEBUG') ||
            this.stdout.includes('FAILURES!') ||
            this.exitCode === 1
        );
    }
}

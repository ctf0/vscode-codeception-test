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
        const output = this.stdout.split('\n')
        const resultsIndex = output.findIndex((line) => line.includes('Codeception Results'));

        if (!resultsIndex) {
            return defaultStatus;
        }

        const resultLine = output[resultsIndex + 1];

        if (!resultLine.match(/: (\d+)\./)) {
            return defaultStatus;
        }

        // Parse numbers from the result line
        const SuccessfulMatches = resultLine.match(/Successful: (\d+)\./);
        const FailedMatches = resultLine.match(/Failed: (\d+)\./);
        const IncompleteMatches = resultLine.match(/Incomplete: (\d+)\./);
        const SkippedMatches = resultLine.match(/Skipped: (\d+)\./);
        const UselessMatches = resultLine.match(/Useless: (\d+)\./);

        return {
            successful : SuccessfulMatches?.length ? parseInt(SuccessfulMatches[1]) : defaultStatus.successful,
            failed: FailedMatches?.length ? parseInt(FailedMatches[1]) : output.findIndex((line) => line.includes('FAIL')),
            incomplete : IncompleteMatches?.length ? parseInt(IncompleteMatches[1]) : defaultStatus.incomplete,
            skipped    : SkippedMatches?.length ? parseInt(SkippedMatches[1]) : defaultStatus.skipped,
            useless    : UselessMatches?.length ? parseInt(UselessMatches[1]) : defaultStatus.useless,
        };
    }
}

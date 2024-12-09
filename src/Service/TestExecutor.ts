import { execa } from 'execa';
import * as vscode from 'vscode';
import { ConfigurationService } from './Config/ConfigurationService';
import { EnvironmentManager } from './Environment/EnvironmentManager';
import { ExecutionError } from './Error/ExecutionError';

export interface ExecutionResult {
    stdout: string;
    stderr: string;
}

export class TestExecutor {
    private readonly configService: ConfigurationService;
    private readonly envManager: EnvironmentManager;

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {
        this.configService = ConfigurationService.getInstance();
        this.envManager = new EnvironmentManager(this.configService.getConfig());
    }

    public async executeCommand(command: string): Promise<ExecutionResult> {
        try {
            // Split command into command and arguments
            const [cmd, ...args] = command.split(' ');

            const { stdout, stderr } = await execa(cmd, args, {
                cwd: this.workspaceFolder.uri.fsPath,
                env: this.envManager.getCoverageEnvironment(),
                reject: false, // Don't reject on non-zero exit codes
                all: true // Merge stdout and stderr
            });

            return {
                stdout: stdout || '',
                stderr: stderr || ''
            };
        } catch (error) {
            const execError = ExecutionError.fromError(error, command);
            
            if (execError.isTestFailure()) {
                return {
                    stdout: execError.stdout,
                    stderr: execError.stderr
                };
            }

            throw execError;
        }
    }
}

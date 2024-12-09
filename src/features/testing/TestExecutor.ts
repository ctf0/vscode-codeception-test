import { EnvironmentManager } from '@src/core/environment/EnvironmentManager';
import { PathResolver } from '@src/core/environment/PathResolver';
import { ExecutionError } from '@src/core/errors/ExecutionError';
import { execa } from 'execa';
import * as vscode from 'vscode';

export interface ExecutionResult {
    stdout : string;
    stderr : string;
}

export class TestExecutor {
    private readonly envManager   : EnvironmentManager;
    private readonly pathResolver : PathResolver;

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {
        this.envManager = new EnvironmentManager();
        this.pathResolver = PathResolver.getInstance();
    }

    public async executeCommand(command: string): Promise<ExecutionResult> {
        try {
            // Split command into command and args
            const [cmd, ...args] = this.pathResolver.resolvePath(command).split(' ');

            const { stdout, stderr } = await execa(cmd, args, {
                cwd    : this.workspaceFolder.uri.fsPath,
                env    : this.envManager.getEnvironment(),
                reject : false, // Don't reject on non-zero exit codes
                all    : false, // Don't merge stdout and stderr
            });

            return {
                stdout : stdout || '',
                stderr : stderr || '',
            };
        } catch (error) {
            const execError = ExecutionError.fromError(error, command);

            return {
                stdout : execError.stdout,
                stderr : execError.stderr,
            };
        }
    }
}

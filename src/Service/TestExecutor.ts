import { execa } from 'execa';
import * as vscode from 'vscode';
import { ExecutionError } from '../Util/ExecutionError';
import { ConfigurationService } from './Config/ConfigurationService';
import { EnvironmentManager } from './Environment/EnvironmentManager';
import { PathResolver } from './Environment/PathResolver';

export interface ExecutionResult {
    stdout : string;
    stderr : string;
}

export class TestExecutor {
    private readonly envManager   : EnvironmentManager;
    private readonly pathResolver : PathResolver;

    constructor(private readonly workspaceFolder: vscode.WorkspaceFolder, private readonly configService: ConfigurationService) {
        this.envManager = new EnvironmentManager(this.configService.getConfig());
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

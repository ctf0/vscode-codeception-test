import * as vscode from 'vscode';

export class PathResolver {
    private static instance : PathResolver;
    private workspaceFolder : vscode.WorkspaceFolder | undefined;

    private constructor() {
        this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    }

    public static getInstance(): PathResolver {
        if (!PathResolver.instance) {
            PathResolver.instance = new PathResolver();
        }

        return PathResolver.instance;
    }

    public resolvePath(path: string): string {
        if (!this.workspaceFolder || !path.includes('${workspaceFolder}')) {
            return path;
        }

        return path.replace('${workspaceFolder}', this.workspaceFolder.uri.fsPath);
    }

    public getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        return this.workspaceFolder;
    }
}

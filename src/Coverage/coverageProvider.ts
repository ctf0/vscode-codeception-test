import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PathResolver } from '../Service/Environment/PathResolver';

export class CodeceptionCoverageProvider implements vscode.Disposable {
    private workspaceFolder: vscode.WorkspaceFolder;
    private coverageMap: Map<string, vscode.FileCoverage> = new Map();
    private pathResolver: PathResolver;
    private readonly decorationType: vscode.TextEditorDecorationType;

    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        this.workspaceFolder = workspaceFolder;
        this.pathResolver = PathResolver.getInstance();
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('coverage.uncoveredBackground'),
            isWholeLine: true,
        });

        this.setupDecorations();
    }

    private setupDecorations(): void {
        // Update decorations when active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateEditorDecorations(editor);
            }
        });

        // Update decorations when coverage data changes
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                this.updateEditorDecorations(editor);
            }
        });
    }

    private updateEditorDecorations(editor: vscode.TextEditor): void {
        const coverage = this.coverageMap.get(editor.document.uri.toString());
        if (!coverage) return;

        const uncoveredRanges: vscode.Range[] = [];

        if (coverage.statementCoverage) {
            const { covered, total } = coverage.statementCoverage;
            const percentage = Math.round((covered / total) * 100);
            editor.setDecorations(this.decorationType, uncoveredRanges);
        }
    }

    private resolveFilePath(filePath: string, pathMapping: Record<string, string>): string | null {
        if (!filePath) return null;

        // Try to apply path mappings
        if (pathMapping && Object.keys(pathMapping).length > 0) {
            // Sort path mappings by length (longest first) to ensure more specific paths are replaced first
            const sortedMappings = Object.entries(pathMapping)
                .sort(([a], [b]) => b.length - a.length);

            for (const [remotePath, localPath] of sortedMappings) {
                const resolvedLocalPath = this.pathResolver.resolvePath(localPath);
                if (filePath.startsWith(remotePath)) {
                    // Replace the remote path with the local path
                    return filePath.replace(remotePath, resolvedLocalPath);
                }
            }
        }

        return filePath;
    }

    async loadCoverage(xmlPath: string, pathMapping: Record<string, string>): Promise<void> {
        try {
            const xml = await fs.promises.readFile(xmlPath, 'utf8');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: ''
            });
            const result = parser.parse(xml);

            // Process coverage data
            const files = result.coverage.project.file;
            if (!files) return;

            const fileArray = Array.isArray(files) ? files : [files];
            this.coverageMap.clear();

            for (const file of fileArray) {
                const filePath = this.resolveFilePath(file.name, pathMapping);
                if (!filePath) continue;

                const uri = vscode.Uri.file(
                    path.isAbsolute(filePath)
                        ? filePath
                        : path.join(this.workspaceFolder.uri.fsPath, filePath)
                );

                const lines = file.line;
                if (!lines) continue;

                const lineArray = Array.isArray(lines) ? lines : [lines];
                const ranges: vscode.Range[] = [];
                const counts: number[] = [];

                for (const line of lineArray) {
                    const lineNum = parseInt(line.num) - 1;
                    const count = parseInt(line.count);

                    if (!isNaN(lineNum) && !isNaN(count)) {
                        ranges.push(new vscode.Range(lineNum, 0, lineNum, 0));
                        counts.push(count);
                    }
                }

                const coveredCount = counts.filter(count => count > 0).length;

                this.coverageMap.set(uri.toString(), {
                    uri,
                    statementCoverage: {
                        covered: coveredCount,
                        total: ranges.length
                    }
                });
            }

            // Update decorations for all visible editors
            this.updateAllEditorDecorations();
            this.notifyCoverageStats();
        } catch (err) {
            console.error('Failed to parse coverage XML:', err);
            throw err;
        }
    }

    private updateAllEditorDecorations(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            this.updateEditorDecorations(editor);
        });
    }

    private notifyCoverageStats(): void {
        let totalCovered = 0;
        let totalLines = 0;

        this.coverageMap.forEach(coverage => {
            if (coverage.statementCoverage) {
                totalCovered += coverage.statementCoverage.covered;
                totalLines += coverage.statementCoverage.total;
            }
        });

        const percentage = totalLines > 0 ? Math.round((totalCovered / totalLines) * 100) : 0;
        vscode.window.showInformationMessage(`Coverage: ${percentage}% (${totalCovered}/${totalLines} lines)`);
    }

    clear(): void {
        this.coverageMap.clear();
        this.updateAllEditorDecorations();
    }

    dispose(): void {
        this.clear();
        this.decorationType.dispose();
    }
}

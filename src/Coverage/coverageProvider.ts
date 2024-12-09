import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PathResolver } from '../Service/Environment/PathResolver';

interface CoverageInfo {
    uri    : vscode.Uri;
    ranges : vscode.Range[];
    counts : number[];
}

export class CodeceptionCoverageProvider implements vscode.Disposable {
    private workspaceFolder         : vscode.WorkspaceFolder;
    private coverageMap             : Map<string, CoverageInfo> = new Map();
    private pathResolver            : PathResolver;
    private readonly decorationType : vscode.TextEditorDecorationType;
    private disposables             : vscode.Disposable[] = [];

    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        this.workspaceFolder = workspaceFolder;
        this.pathResolver = PathResolver.getInstance();
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor    : new vscode.ThemeColor('testing.uncoveredGutterBackground'),
            isWholeLine        : true,
            overviewRulerColor : new vscode.ThemeColor('testing.uncoveredBorder'),
            overviewRulerLane  : vscode.OverviewRulerLane.Full,
            gutterIconPath     : new vscode.ThemeIcon('error').id,
            gutterIconSize     : 'contain',
        });

        this.setupDecorations();
    }

    private setupDecorations(): void {
        // Update decorations when active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.updateEditorDecorations(editor);
                }
            }),

            // Update decorations when coverage data changes
            vscode.workspace.onDidChangeTextDocument((event) => {
                const editor = vscode.window.activeTextEditor;

                if (editor && event.document === editor.document) {
                    this.updateEditorDecorations(editor);
                }
            }),

            // Update decorations when editor becomes visible
            vscode.window.onDidChangeVisibleTextEditors((editors) => {
                editors.forEach((editor) => this.updateEditorDecorations(editor));
            }),

            // Add decoration type to disposables
            this.decorationType,
        );
    }

    private updateEditorDecorations(editor: vscode.TextEditor): void {
        const coverage = this.coverageMap.get(editor.document.uri.toString());

        if (!coverage) return;

        const uncoveredRanges = coverage.ranges
            .filter((_, index) => coverage.counts[index] === 0)
            .map((range) =>
                // Extend range to full line for better visibility
                new vscode.Range(
                    range.start.line,
                    0,
                    range.end.line,
                    Number.MAX_VALUE,
                ),
            );

        editor.setDecorations(this.decorationType, uncoveredRanges);
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
                ignoreAttributes    : false,
                attributeNamePrefix : '',
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
                        : path.join(this.workspaceFolder.uri.fsPath, filePath),
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
                        ranges.push(new vscode.Range(lineNum, 0, lineNum, Number.MAX_VALUE));
                        counts.push(count);
                    }
                }

                this.coverageMap.set(uri.toString(), { uri, ranges, counts });
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
        vscode.window.visibleTextEditors.forEach((editor) => {
            this.updateEditorDecorations(editor);
        });
    }

    private notifyCoverageStats(): void {
        let totalCovered = 0;
        let totalLines = 0;

        this.coverageMap.forEach((coverage) => {
            coverage.counts.forEach((count) => {
                if (count > 0) totalCovered++;
                totalLines++;
            });
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
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}

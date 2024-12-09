import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class CodeceptionCoverageProvider {
    private coverageMap = new Map<string, vscode.FileCoverage>();

    constructor(private workspaceFolder: vscode.WorkspaceFolder) { }

    async provideFileCoverage(): Promise<vscode.FileCoverage[]> {
        return Array.from(this.coverageMap.values());
    }

    async resolveFileCoverage(coverage: vscode.FileCoverage): Promise<vscode.FileCoverage> {
        return coverage;
    }

    async loadCoverage(xmlPath: string, pathMapping: Object, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
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

            for (const file of fileArray) {
                let filePath = file.name;
                if (!filePath) continue;

                if (Object.keys(pathMapping).length) {
                    filePath = Object.entries(pathMapping)
                        .map(([key, value]) => filePath.replace(
                            key,
                            value.replace(/\${workspaceFolder}/g, workspaceFolder.uri.fsPath)
                        ))[0]
                }

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
                    },
                    branchCoverage: undefined
                });
            }
        } catch (err) {
            console.error('Failed to parse coverage XML:', err);
            throw err;
        }
    }

    clear(): void {
        this.coverageMap.clear();
    }
}

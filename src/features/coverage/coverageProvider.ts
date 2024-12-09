import { PathResolver } from '@src/core/environment/PathResolver';
import { i18n } from '@src/services/i18n/i18n';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface CoverageInfo {
    uri: vscode.Uri;
    ranges: vscode.Range[];
    counts: number[];
}

export class CodeceptionCoverageProvider implements vscode.Disposable {
    private workspaceFolder: vscode.WorkspaceFolder;
    private coverageMap: Map<string, CoverageInfo> = new Map();
    private pathResolver: PathResolver;
    private disposables: vscode.Disposable[] = [];

    constructor(
        workspaceFolder: vscode.WorkspaceFolder,
    ) {
        this.workspaceFolder = workspaceFolder;
        this.pathResolver = PathResolver.getInstance();
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

    public async loadCoverage(xmlPath: string, pathMapping: Record<string, string>): Promise<void> {
        try {
            if (!fs.existsSync(xmlPath)) {
                throw new Error(i18n.t('coverage.fileNotFound', xmlPath));
            }

            const stats = fs.statSync(xmlPath);
            if (!stats.isFile()) {
                throw new Error(i18n.t('coverage.notAFile', xmlPath));
            }

            const xml = await fs.promises.readFile(xmlPath, 'utf8');

            if (!xml.trim()) {
                throw new Error(i18n.t('coverage.fileEmpty'));
            }

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '',
                parseAttributeValue: true,
            });

            const result = parser.parse(xml);

            if (!result.coverage?.project?.file) {
                throw new Error(i18n.t('coverage.invalidFormat'));
            }

            // Process coverage data
            await this.processCoverageData(result.coverage.project.file, pathMapping);
        } catch (error) {
            const message = error instanceof Error ? error.message : i18n.t('coverage.loadError');
            console.error('Failed to parse coverage XML:', message);
            vscode.window.showErrorMessage(i18n.t('coverage.loadError', message));
            throw error;
        }
    }

    private async processCoverageData(files: any, pathMapping: Record<string, string>): Promise<void> {
        this.coverageMap.clear();
        const fileArray = Array.isArray(files) ? files : [files];

        for (const file of fileArray) {
            try {
                await this.processFileCoverage(file, pathMapping);
            } catch (error) {
                console.error(`Error processing coverage for file ${file.name}:`, error);
            }
        }
    }

    private async processFileCoverage(file: any, pathMapping: Record<string, string>): Promise<void> {
        const filePath = this.resolveFilePath(file.name, pathMapping);

        if (!filePath) return;

        const uri = vscode.Uri.file(
            path.isAbsolute(filePath)
                ? filePath
                : path.join(this.workspaceFolder.uri.fsPath, filePath),
        );

        // Skip if no line data
        if (!file.line) return;

        const lines = Array.isArray(file.line) ? file.line : [file.line];
        const ranges: vscode.Range[] = [];
        const counts: number[] = [];

        for (const line of lines) {
            // Skip invalid lines
            if (!line || typeof line.num === 'undefined' || typeof line.count === 'undefined') {
                continue;
            }

            const lineNum = parseInt(line.num) - 1;
            const count = parseInt(line.count);

            if (!isNaN(lineNum) && !isNaN(count)) {
                ranges.push(new vscode.Range(lineNum, 0, lineNum, Number.MAX_VALUE));
                counts.push(count);
            }
        }

        // Only add to coverage map if we have valid data
        if (ranges.length > 0) {
            this.coverageMap.set(uri.toString(), { uri, ranges, counts });
        }
    }

    public getCoverageData(): Map<string, CoverageInfo> {
        return this.coverageMap;
    }

    dispose(): void {
        this.coverageMap.clear();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}

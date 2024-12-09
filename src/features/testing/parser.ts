import { TestClass, TestMethod } from '@src/core/types/types';
import { Engine } from 'php-parser';
import * as vscode from 'vscode';
const DocParser = require('doc-parser');

export class PhpTestParser {
    private parser: Engine;

    constructor() {
        this.parser = new Engine({
            parser: {
                extractDoc : true,
                locations  : true,
                php7       : true,
            },
            ast: {
                withPositions: true,
            },
        });
    }

    public async parseTestFile(content: string): Promise<TestClass | null> {
        let testClass: TestClass | null = null;

        try {
            const ast = this.parser.parseCode(content, 'test.php');
            const classNode = this.findFirstClassNode(ast);

            if (!classNode) return null;

            const parsedClass = this.parseClassNode(classNode, ast);
            testClass = parsedClass || null;

            return testClass;
        } catch (error) {
            console.error('Error parsing test file:', error);

            return null;
        }
    }

    public async findTestFiles(testPaths: string[]): Promise<vscode.Uri[]> {
        const files: vscode.Uri[] = [];

        for (const testPath of testPaths) {
            // Search for test files in each test path
            const pathFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(
                    vscode.workspace.workspaceFolders![0],
                    `${testPath}/**/*{Cest,Test}.php`,
                ),
                '**/vendor/**',
            );
            files.push(...pathFiles);
        }

        return files;
    }

    public async parseTestFiles(files: vscode.Uri[]): Promise<TestClass[]> {
        const testClasses: TestClass[] = [];

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const testClass = await this.parseTestFile(content.toString());

                if (testClass) {
                    testClass.uri = file;
                    testClasses.push(testClass);
                }
            } catch (error) {
                console.error(`Error parsing file ${file.fsPath}:`, error);
            }
        }

        return testClasses;
    }

    private findNamespace(ast: any): string | undefined {
        if (!ast || !ast.children) return undefined;

        for (const node of ast.children) {
            if (node.kind === 'namespace') {
                // Handle both string and array namespace formats
                return Array.isArray(node.name) ? node.name.join('\\') : node.name;
            }
        }

        return undefined;
    }

    private findFirstClassNode(ast: any): any {
        if (!ast || !ast.children) return null;

        // First try to find a test class
        for (const node of ast.children) {
            if (node.kind === 'namespace') {
                for (const child of node.children) {
                    if (child.kind === 'class' && this.isTestClass(child.name.name)) {
                        return child;
                    }
                }
            } else if (node.kind === 'class' && this.isTestClass(node.name.name)) {
                return node;
            }
        }

        // If no test class found, return any class
        for (const node of ast.children) {
            if (node.kind === 'namespace') {
                for (const child of node.children) {
                    if (child.kind === 'class') {
                        return child;
                    }
                }
            } else if (node.kind === 'class') {
                return node;
            }
        }

        return null;
    }

    private isTestClass(className: string): boolean {
        className = className.toLowerCase();

        return className.endsWith('test') || className.endsWith('cest');
    }

    private parseMethodNode(node: any): TestMethod | undefined {
        if (node.kind !== 'method' || node.visibility !== 'public') {
            return undefined;
        }

        // Check if this is a test method (starts with 'test' or has @test annotation)
        const methodName = node.name.name;
        const hasTestAnnotation = node.leadingComments?.some((comment: any) =>
            comment.value.includes('@test'),
        );

        if (!methodName.startsWith('test') && !hasTestAnnotation) {
            return undefined;
        }

        // Ensure we have location information
        if (!node.loc) {
            return undefined;
        }

        const docblock = node.leadingComments?.[0]?.value
            ? this.parseDocBlock(node.leadingComments[0].value)
            : undefined;

        return {
            name      : methodName,
            startLine : node.loc.start.line - 1,
            endLine   : node.loc.end.line - 1,
            docblock  : docblock,
            tags      : this.parseTags(docblock),
        };
    }

    private parseTags(docblock: any): vscode.TestTag[] {
        return docblock?.body
            .filter((item: any) => item.kind === 'block' && item.name === 'group')
            .map((item: any) => item.options[0].value)
            .map((item: string) => new vscode.TestTag(item))
            || [];
    }

    private parseMethodNodes(classNode: any): TestMethod[] {
        const methods: TestMethod[] = [];

        if (classNode.body) {
            for (const item of classNode.body) {
                const method = this.parseMethodNode(item);

                if (method) {
                    methods.push(method);
                }
            }
        }

        return methods;
    }

    private parseClassNode(classNode: any, ast: any): TestClass | null {
        if (!classNode) return null;

        const className = classNode.name.name;
        const namespace = this.findNamespace(ast);
        const fullName = namespace ? `${namespace}\\${className}` : className;
        const methods = this.parseMethodNodes(classNode);

        const docblock = classNode.leadingComments?.[0]?.value
            ? this.parseDocBlock(classNode.leadingComments[0].value)
            : undefined;

        return {
            name      : className,
            fullName,
            methods,
            startLine : classNode.loc.start.line - 1,
            endLine   : classNode.loc.end.line - 1,
            docblock,
            tags      : this.parseTags(docblock),
            uri       : vscode.Uri.file(''), // This will be set later when parsing files
            suite     : undefined, // This will be set based on configuration
        };
    }

    private parseDocBlock(docblock: string): any {
        if (!docblock) return undefined;

        const reader = new DocParser();

        return reader.parse(docblock);
    }
}

export default PhpTestParser;

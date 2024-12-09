import * as vscode from 'vscode';
import { TestClass } from '@src/core/types/types';

export class TestData {
    private items: Map<string, TestClass> = new Map();

    public clear(): void {
        this.items.clear();
    }

    public addItems(items: TestClass[]): void {
        for (const item of items) {
            this.items.set(item.fullName, item);
        }
    }

    public addItem(item: TestClass): void {
        this.items.set(item.uri.toString(), item);
    }

    public getItem(id: string): TestClass | undefined {
        return this.items.get(id);
    }

    public getAllItems(): TestClass[] {
        return Array.from(this.items.values());
    }

    public setItem(id: string, item: TestClass): void {
        this.items.set(id, item);
    }

    public getAllTests(): vscode.TestItem[] {
        const tests: vscode.TestItem[] = [];
        for (const item of this.items.values()) {
            if (item.testItem) {
                tests.push(item.testItem);

                if (item.methods) {
                    for (const method of item.methods) {
                        if (method.testItem) {
                            tests.push(method.testItem);
                        }
                    }
                }
            }
        }

        return tests;
    }

    public getTestData(test: vscode.TestItem): { className: string; method?: string; configFile?: string } | undefined {
        const isMethodTest = test.id.includes(':') && !test.id.startsWith('test:');
        const parentId = isMethodTest ? test.parent!.id : test.id;
        const item = this.getItem(parentId);

        if (!item) {
            return undefined;
        }

        if (isMethodTest) {
            const methodName = test.label.replace('$(symbol-method) ', '');
            const method = item.methods.find((m) => m.name === methodName);

            if (!method) {
                return undefined;
            }

            return {
                className  : item.name,
                method     : methodName,
                configFile : item.configFile,
            };
        }

        return {
            className  : item.name,
            configFile : item.configFile,
        };
    }
}

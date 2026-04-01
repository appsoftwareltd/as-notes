import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => {
    class Position {
        constructor(public line: number, public character: number) { }
    }

    class Range {
        constructor(public start: Position, public end: Position) { }
    }

    class CompletionItem {
        detail?: string;
        sortText?: string;
        filterText?: string;
        insertText?: string;
        range?: Range;

        constructor(public label: string, public kind?: number) { }
    }

    class CompletionList {
        constructor(public items: CompletionItem[], public isIncomplete?: boolean) { }
    }

    return {
        Position,
        Range,
        CompletionItem,
        CompletionList,
        CompletionItemKind: {
            File: 0,
            Reference: 1,
        },
    };
});

import * as vscode from 'vscode';
import { WikilinkCompletionProvider } from '../WikilinkCompletionProvider.js';

describe('Wikilink code suppression', () => {
    it('suppresses completion inside inline code', () => {
        const provider = new WikilinkCompletionProvider(
            { isOpen: false } as never,
            { time: () => () => { }, info: () => { } } as never,
        );

        const document = {
            lineCount: 1,
            lineAt: (line: number) => ({
                text: line === 0 ? 'Some `[[Demo` code' : '',
            }),
        } as vscode.TextDocument;

        const result = provider.provideCompletionItems(
            document,
            new vscode.Position(0, 12),
            {} as vscode.CancellationToken,
            {} as vscode.CompletionContext,
        );

        expect(result).toBeUndefined();
    });

    it('suppresses completion inside bullet-owned fenced code blocks', () => {
        const provider = new WikilinkCompletionProvider(
            { isOpen: false } as never,
            { time: () => () => { }, info: () => { } } as never,
        );

        const lines = ['- ```', '  [[Demo', '  ```', '- after'];
        const document = {
            lineCount: lines.length,
            lineAt: (line: number) => ({
                text: lines[line] ?? '',
            }),
        } as vscode.TextDocument;

        const result = provider.provideCompletionItems(
            document,
            new vscode.Position(1, 8),
            {} as vscode.CancellationToken,
            {} as vscode.CompletionContext,
        );

        expect(result).toBeUndefined();
    });
});
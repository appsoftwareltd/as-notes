import * as vscode from 'vscode';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';
import { WikilinkDecorationManager } from './WikilinkDecorationManager.js';
import { WikilinkDocumentLinkProvider } from './WikilinkDocumentLinkProvider.js';
import { WikilinkHoverProvider } from './WikilinkHoverProvider.js';
import { WikilinkRenameTracker } from './WikilinkRenameTracker.js';

const MARKDOWN_SELECTOR: vscode.DocumentSelector = { language: 'markdown' };

export function activate(context: vscode.ExtensionContext): void {
    const wikilinkService = new WikilinkService();
    const fileService = new WikilinkFileService();

    // Decoration manager — highlights wikilinks with default/active styles
    const decorationManager = new WikilinkDecorationManager(wikilinkService);
    context.subscriptions.push(decorationManager);

    // Document link provider — Ctrl/Cmd+Click navigation
    const linkProvider = new WikilinkDocumentLinkProvider(wikilinkService, fileService);
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(MARKDOWN_SELECTOR, linkProvider),
    );

    // Hover provider — tooltip with target filename and existence status
    const hoverProvider = new WikilinkHoverProvider(wikilinkService, fileService);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(MARKDOWN_SELECTOR, hoverProvider),
    );

    // Rename tracker — detects wikilink edits and offers to rename files + links
    const renameTracker = new WikilinkRenameTracker(wikilinkService, fileService);
    context.subscriptions.push(renameTracker);

    // Command for wikilink navigation (invoked by DocumentLink command URIs)
    context.subscriptions.push(
        vscode.commands.registerCommand('as-notes.navigateWikilink', async (args: {
            targetUri: string;
            pageName: string;
            pageFileName: string;
            sourceUri: string;
        }) => {
            const targetUri = vscode.Uri.parse(args.targetUri);
            const sourceUri = vscode.Uri.parse(args.sourceUri);
            await fileService.navigateToFile(targetUri, args.pageFileName, sourceUri);
        }),
    );
}

export function deactivate(): void {
    // Cleanup handled by disposables in context.subscriptions
}

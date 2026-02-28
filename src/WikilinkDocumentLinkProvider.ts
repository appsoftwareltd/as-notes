import * as vscode from 'vscode';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';

/**
 * Provides clickable document links for wikilinks in markdown files.
 *
 * Wikilinks are split into non-overlapping segments so that nested links
 * are individually clickable. For `[[Outer [[Inner]] text]]`, three
 * segments are produced — clicking `[[Inner]]` navigates to `Inner.md`,
 * while clicking `[[Outer ` or ` text]]` navigates to `Outer [[Inner]] text.md`.
 */
export class WikilinkDocumentLinkProvider implements vscode.DocumentLinkProvider {
    private readonly wikilinkService: WikilinkService;
    private readonly fileService: WikilinkFileService;

    constructor(wikilinkService: WikilinkService, fileService: WikilinkFileService) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;
    }

    provideDocumentLinks(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken,
    ): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];

        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            const line = document.lineAt(lineIndex);
            const wikilinks = this.wikilinkService.extractWikilinks(line.text);

            if (wikilinks.length === 0) {
                continue;
            }

            // Compute non-overlapping segments so nested links are independently clickable
            const segments = this.wikilinkService.computeLinkSegments(wikilinks);

            for (const segment of segments) {
                const range = new vscode.Range(
                    lineIndex, segment.startOffset,
                    lineIndex, segment.endOffset,
                );

                const wl = segment.wikilink;
                const targetUri = this.fileService.resolveTargetUri(document.uri, wl.pageFileName);

                const commandUri = vscode.Uri.parse(
                    `command:as-notes.navigateWikilink?${encodeURIComponent(JSON.stringify({
                        targetUri: targetUri.toString(),
                        pageName: wl.pageName,
                        pageFileName: wl.pageFileName,
                        sourceUri: document.uri.toString(),
                    }))}`,
                );

                const link = new vscode.DocumentLink(range, commandUri);
                link.tooltip = `Navigate to ${wl.pageFileName}.md`;
                links.push(link);
            }
        }

        return links;
    }
}

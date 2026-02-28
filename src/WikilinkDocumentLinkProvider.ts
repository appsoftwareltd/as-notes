import * as vscode from 'vscode';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';
import type { IndexService } from './IndexService.js';

/**
 * Provides clickable document links for wikilinks in markdown files.
 *
 * Wikilinks are split into non-overlapping segments so that nested links
 * are individually clickable. For `[[Outer [[Inner]] text]]`, three
 * segments are produced — clicking `[[Inner]]` navigates to `Inner.md`,
 * while clicking `[[Outer ` or ` text]]` navigates to `Outer [[Inner]] text.md`.
 *
 * When an IndexService is available, alias links show the canonical page
 * in their tooltip (e.g. "Navigate to ActualPage.md (alias)").
 */
export class WikilinkDocumentLinkProvider implements vscode.DocumentLinkProvider {
    private readonly wikilinkService: WikilinkService;
    private readonly fileService: WikilinkFileService;
    private readonly indexService?: IndexService;

    constructor(
        wikilinkService: WikilinkService,
        fileService: WikilinkFileService,
        indexService?: IndexService,
    ) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;
        this.indexService = indexService;
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

                // Build tooltip — show alias indicator if this link resolves via alias
                let tooltip = `Navigate to ${wl.pageFileName}.md`;
                if (this.indexService?.isOpen) {
                    const resolution = this.fileService.resolveViaIndex(document.uri, wl.pageFileName);
                    if (resolution?.viaAlias) {
                        const canonicalFilename = resolution.page.filename;
                        tooltip = `Navigate to ${canonicalFilename} (alias: ${wl.pageFileName})`;
                    }
                }

                const link = new vscode.DocumentLink(range, commandUri);
                link.tooltip = tooltip;
                links.push(link);
            }
        }

        return links;
    }
}

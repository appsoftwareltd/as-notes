import * as vscode from 'vscode';
import { WikilinkService } from 'as-notes-common';
import { WikilinkFileService } from './WikilinkFileService.js';
import type { IndexService } from './IndexService.js';

/**
 * Shows a hover tooltip over wikilinks with the target filename,
 * whether the file exists or will be created, and backlink count
 * when the index is available.
 */
export class WikilinkHoverProvider implements vscode.HoverProvider {
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

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
    ): Promise<vscode.Hover | undefined> {
        const line = document.lineAt(position.line);
        const wikilinks = this.wikilinkService.extractWikilinks(line.text);

        const wikilink = this.wikilinkService.findInnermostWikilinkAtOffset(
            wikilinks,
            position.character,
        );

        if (!wikilink) {
            return undefined;
        }

        const resolution = await this.fileService.resolveTargetUriCaseInsensitive(
            document.uri,
            wikilink.pageFileName,
        );
        const targetUri = resolution.uri;
        const viaAlias = resolution.viaAlias;
        const exists = await this.fileService.fileExists(targetUri);

        const range = new vscode.Range(
            position.line, wikilink.startPositionInText,
            position.line, wikilink.endPositionInText + 1,
        );

        const status = exists ? '$(file) Existing file' : '$(new-file) Will be created';

        // Resolve display name: if via alias, show the canonical filename
        const displayFilename = viaAlias
            ? `${wikilink.pageFileName}.md → ${targetUri.fsPath.split(/[\\/]/).pop()}`
            : `${wikilink.pageFileName}.md`;

        let aliasInfo = '';
        if (viaAlias) {
            aliasInfo = '\n\n$(symbol-reference) Alias';
        }

        let backlinkInfo = '';
        if (this.indexService?.isOpen) {
            // If via alias, count backlinks including aliases for the canonical page
            if (viaAlias) {
                const resolved = this.indexService.resolveAlias(wikilink.pageFileName);
                if (resolved) {
                    const count = this.indexService.getBacklinkCountIncludingAliases(resolved.id);
                    if (count > 0) {
                        backlinkInfo = `\n\n$(references) ${count} backlink${count === 1 ? '' : 's'}`;
                    }
                }
            } else {
                const count = this.indexService.getBacklinkCount(wikilink.pageFileName);
                if (count > 0) {
                    backlinkInfo = `\n\n$(references) ${count} backlink${count === 1 ? '' : 's'}`;
                }
            }
        }

        const commandArgs = encodeURIComponent(JSON.stringify([{ pageFileName: wikilink.pageFileName, pageName: wikilink.pageName }]));
        const viewBacklinksLink = `\n\n[$(references) View Backlinks](command:as-notes.viewBacklinksForPage?${commandArgs})`;

        const markdown = new vscode.MarkdownString(
            `**${displayFilename}**\n\n${status}${aliasInfo}${backlinkInfo}${viewBacklinksLink}`,
        );
        markdown.supportThemeIcons = true;
        markdown.isTrusted = { enabledCommands: ['as-notes.viewBacklinksForPage'] };

        return new vscode.Hover(markdown, range);
    }
}

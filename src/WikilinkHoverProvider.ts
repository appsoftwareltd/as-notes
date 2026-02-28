import * as vscode from 'vscode';
import { WikilinkService } from './WikilinkService.js';
import { WikilinkFileService } from './WikilinkFileService.js';

/**
 * Shows a hover tooltip over wikilinks with the target filename
 * and whether the file exists or will be created.
 */
export class WikilinkHoverProvider implements vscode.HoverProvider {
    private readonly wikilinkService: WikilinkService;
    private readonly fileService: WikilinkFileService;

    constructor(wikilinkService: WikilinkService, fileService: WikilinkFileService) {
        this.wikilinkService = wikilinkService;
        this.fileService = fileService;
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

        const targetUri = await this.fileService.resolveTargetUriCaseInsensitive(
            document.uri,
            wikilink.pageFileName,
        );
        const exists = await this.fileService.fileExists(targetUri);

        const range = new vscode.Range(
            position.line, wikilink.startPositionInText,
            position.line, wikilink.endPositionInText + 1,
        );

        const status = exists ? '$(file) Existing file' : '$(new-file) Will be created';
        const markdown = new vscode.MarkdownString(
            `**${wikilink.pageFileName}.md**\n\n${status}`,
        );
        markdown.supportThemeIcons = true;

        return new vscode.Hover(markdown, range);
    }
}

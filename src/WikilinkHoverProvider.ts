import * as vscode from 'vscode';
import { WikilinkService } from './WikilinkService.js';
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

        let backlinkInfo = '';
        if (this.indexService?.isOpen) {
            const count = this.indexService.getBacklinkCount(wikilink.pageFileName);
            if (count > 0) {
                backlinkInfo = `\n\n$(references) ${count} backlink${count === 1 ? '' : 's'}`;
            }
        }

        const markdown = new vscode.MarkdownString(
            `**${wikilink.pageFileName}.md**\n\n${status}${backlinkInfo}`,
        );
        markdown.supportThemeIcons = true;

        return new vscode.Hover(markdown, range);
    }
}

import * as vscode from 'vscode';
import { WikilinkService } from 'as-notes-common';
import type { IndexScanner } from './IndexScanner.js';
import type { IndexService } from './IndexService.js';
import { toNotesRelativePath } from './NotesRootService.js';

export interface UpdateLinksInWorkspaceOptions {
    candidateUris?: vscode.Uri[];
}

export interface ReindexWorkspaceUriDeps {
    indexService: Pick<IndexService, 'indexFileContent'>;
    indexScanner: Pick<IndexScanner, 'indexFile'>;
    notesRootPath?: string;
}

/**
 * Replace every matching `[[oldPageName]]` wikilink with `[[newPageName]]`
 * across all markdown files in the workspace.
 *
 * Accepts multiple rename pairs and applies them all in a single
 * `WorkspaceEdit`.
 */
export async function updateLinksInWorkspace(
    wikilinkService: WikilinkService,
    renames: { oldPageName: string; newPageName: string }[],
    options?: UpdateLinksInWorkspaceOptions,
): Promise<vscode.Uri[]> {
    if (renames.length === 0) { return []; }

    const mdFiles = options?.candidateUris && options.candidateUris.length > 0
        ? dedupeUris(options.candidateUris)
        : await vscode.workspace.findFiles('**/*.{md,markdown}');
    const workspaceEdit = new vscode.WorkspaceEdit();
    let hasOpenDocumentEdits = false;
    const affectedUris = new Map<string, vscode.Uri>();
    const renameMap = new Map(renames.map(rename => [rename.oldPageName, rename.newPageName]));

    // Build a set of old page names for a cheap pre-scan check.
    const oldPageNames = new Set(renames.map(r => r.oldPageName));

    for (const fileUri of mdFiles) {
        // Prefer already-open document buffers; for closed files, read raw
        // bytes from disk so we don't open a document model unnecessarily.
        const openDoc = vscode.workspace.textDocuments.find(
            d => d.uri.toString() === fileUri.toString(),
        );

        let fullText: string;
        let lines: string[];
        if (openDoc) {
            lines = [];
            for (let i = 0; i < openDoc.lineCount; i++) {
                lines.push(openDoc.lineAt(i).text);
            }
            fullText = lines.join('\n');
        } else {
            const raw = await vscode.workspace.fs.readFile(fileUri);
            fullText = Buffer.from(raw).toString('utf-8');
            lines = fullText.split(/\r?\n/);
        }

        // Quick pre-scan: skip files whose content doesn't mention any old
        // page name (avoids the more expensive per-line wikilink extraction).
        if (!Array.from(oldPageNames).some(name => fullText.includes(name))) {
            continue;
        }

        if (openDoc) {
            for (let line = 0; line < lines.length; line++) {
                const text = lines[line];
                const wikilinks = wikilinkService.extractWikilinks(text);

                for (const wl of wikilinks) {
                    const newPageName = renameMap.get(wl.pageName);
                    if (newPageName) {
                        const range = new vscode.Range(
                            line, wl.startPositionInText,
                            line, wl.endPositionInText + 1,
                        );
                        workspaceEdit.replace(fileUri, range, `[[${newPageName}]]`);
                        hasOpenDocumentEdits = true;
                        affectedUris.set(fileUri.toString(), fileUri);
                    }
                }
            }
            continue;
        }

        const updatedText = rewriteClosedDocument(lines, fullText, wikilinkService, renameMap);
        if (updatedText !== fullText) {
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(updatedText, 'utf-8'));
            affectedUris.set(fileUri.toString(), fileUri);
        }
    }

    if (hasOpenDocumentEdits) {
        await vscode.workspace.applyEdit(workspaceEdit);
    }

    return [...affectedUris.values()];
}

export async function reindexWorkspaceUri(
    uri: vscode.Uri,
    { indexService, indexScanner, notesRootPath }: ReindexWorkspaceUriDeps,
): Promise<'buffer' | 'disk'> {
    const openDocument = vscode.workspace.textDocuments.find(
        doc => doc.uri.toString() === uri.toString(),
    );

    if (openDocument) {
        const relativePath = notesRootPath
            ? toNotesRelativePath(notesRootPath, openDocument.uri.fsPath)
            : vscode.workspace.asRelativePath(openDocument.uri, false);
        const filename = openDocument.uri.fsPath.split(/[/\\]/).pop() ?? '';
        indexService.indexFileContent(relativePath, filename, openDocument.getText(), Date.now());
        return 'buffer';
    }

    await indexScanner.indexFile(uri);
    return 'disk';
}

function dedupeUris(uris: vscode.Uri[]): vscode.Uri[] {
    const unique = new Map<string, vscode.Uri>();
    for (const uri of uris) {
        unique.set(uri.toString(), uri);
    }
    return [...unique.values()];
}

function rewriteClosedDocument(
    lines: string[],
    originalText: string,
    wikilinkService: WikilinkService,
    renameMap: Map<string, string>,
): string {
    const newline = originalText.includes('\r\n') ? '\r\n' : '\n';
    const updatedLines = lines.map((line) => replaceLinksInLine(line, wikilinkService, renameMap));
    return updatedLines.join(newline);
}

function replaceLinksInLine(
    text: string,
    wikilinkService: WikilinkService,
    renameMap: Map<string, string>,
): string {
    const wikilinks = wikilinkService.extractWikilinks(text);
    if (wikilinks.length === 0) {
        return text;
    }

    let updated = text;
    for (let i = wikilinks.length - 1; i >= 0; i--) {
        const wikilink = wikilinks[i];
        const newPageName = renameMap.get(wikilink.pageName);
        if (!newPageName) {
            continue;
        }

        updated =
            updated.slice(0, wikilink.startPositionInText) +
            `[[${newPageName}]]` +
            updated.slice(wikilink.endPositionInText + 1);
    }

    return updated;
}

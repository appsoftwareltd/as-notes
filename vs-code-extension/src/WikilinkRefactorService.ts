import * as vscode from 'vscode';
import { WikilinkService } from 'as-notes-common';

/**
 * Replace every matching `[[oldPageName]]` wikilink with `[[newPageName]]`
 * across all markdown files in the workspace.
 *
 * Accepts multiple rename pairs and applies them all in a single
 * `WorkspaceEdit`, then saves affected files once.
 */
export async function updateLinksInWorkspace(
    wikilinkService: WikilinkService,
    renames: { oldPageName: string; newPageName: string }[],
): Promise<void> {
    if (renames.length === 0) { return; }

    const mdFiles = await vscode.workspace.findFiles('**/*.{md,markdown}');
    const workspaceEdit = new vscode.WorkspaceEdit();
    const affectedUris = new Set<string>();

    for (const fileUri of mdFiles) {
        const doc = await vscode.workspace.openTextDocument(fileUri);

        for (let line = 0; line < doc.lineCount; line++) {
            const text = doc.lineAt(line).text;
            const wikilinks = wikilinkService.extractWikilinks(text);

            for (const wl of wikilinks) {
                for (const r of renames) {
                    if (wl.pageName === r.oldPageName) {
                        const range = new vscode.Range(
                            line, wl.startPositionInText,
                            line, wl.endPositionInText + 1,
                        );
                        workspaceEdit.replace(fileUri, range, `[[${r.newPageName}]]`);
                        affectedUris.add(fileUri.toString());
                    }
                }
            }
        }
    }

    if (affectedUris.size > 0) {
        await vscode.workspace.applyEdit(workspaceEdit);

        // Save affected files so the workspace is in a clean state
        for (const uriStr of affectedUris) {
            const doc = vscode.workspace.textDocuments.find(
                (d) => d.uri.toString() === uriStr,
            );
            if (doc?.isDirty) {
                await doc.save();
            }
        }
    }
}

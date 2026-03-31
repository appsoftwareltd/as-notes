import * as path from 'path';
import * as vscode from 'vscode';
import { FrontMatterService, WikilinkService } from 'as-notes-common';
import type { IndexScanner } from './IndexScanner.js';
import type { IndexService } from './IndexService.js';
import {
    getExistingExplorerMergeTargets,
    pickUniqueExplorerMergeTarget,
} from './WikilinkExplorerMergeService.js';
import { toNotesRelativePath } from './NotesRootService.js';
import { reindexWorkspaceUri, updateLinksInWorkspace } from './WikilinkRefactorService.js';
import { withWikilinkRenameProgress } from './WikilinkRenameProgressService.js';
import {
    collectFilenameRefactorOperations,
    remapUrisForFileOperations,
} from './WikilinkFilenameRefactorService.js';

interface ExplorerRenameFile {
    oldUri: vscode.Uri;
    newUri: vscode.Uri;
}

interface ExplorerRenameRefactorDeps {
    files: ExplorerRenameFile[];
    renameTrackerIsRenaming: boolean;
    wikilinkService: WikilinkService;
    indexService: Pick<IndexService, 'findPagesByFilename' | 'removePage' | 'findPagesLinkingToPageNames' | 'indexFileContent' | 'getAllPages'>;
    indexScanner: Pick<IndexScanner, 'staleScan' | 'indexFile'>;
    notesRootPath?: string;
    safeSaveToFile: () => boolean;
    refreshProviders: () => void;
}

function isMarkdownUri(uri: vscode.Uri): boolean {
    const ext = path.extname(uri.fsPath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
}

export async function handleExplorerRenameRefactors({
    files,
    renameTrackerIsRenaming,
    wikilinkService,
    indexService,
    indexScanner,
    notesRootPath,
    safeSaveToFile,
    refreshProviders,
}: ExplorerRenameRefactorDeps): Promise<void> {
    if (renameTrackerIsRenaming) { return; }

    const linkRenames: { oldPageName: string; newPageName: string }[] = [];

    for (const { oldUri, newUri } of files) {
        if (!isMarkdownUri(newUri)) { continue; }
        const newFilename = path.basename(newUri.fsPath);
        const pages = indexService.findPagesByFilename(newFilename);
        if (pages.length < 2) { continue; }

        const newPath = notesRootPath
            ? toNotesRelativePath(notesRootPath, newUri.fsPath)
            : vscode.workspace.asRelativePath(newUri, false);
        const existingTargets = getExistingExplorerMergeTargets(pages, newPath);
        if (existingTargets.length === 0) { continue; }
        if (existingTargets.length > 1) {
            vscode.window.showWarningMessage(
                `Merge skipped for "${newFilename}": multiple existing targets match this filename.`,
            );
            continue;
        }

        const existingPage = pickUniqueExplorerMergeTarget(pages, newPath);
        if (!existingPage) { continue; }

        const rootUri = notesRootPath
            ? vscode.Uri.file(notesRootPath)
            : vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!rootUri) { continue; }

        const mergeChoice = await vscode.window.showInformationMessage(
            `Merge "${newFilename}" into existing "${existingPage.path}"?`,
            'Yes', 'No',
        );
        if (mergeChoice === 'Yes') {
            await withWikilinkRenameProgress('AS Notes: Applying rename updates', async (progress) => {
                progress.report('Merging renamed page');
                const targetUri = vscode.Uri.joinPath(rootUri, existingPage.path);
                const sourceDoc = await vscode.workspace.openTextDocument(newUri);
                const targetDoc = await vscode.workspace.openTextDocument(targetUri);

                const mergedContent = new FrontMatterService().mergeDocuments(
                    targetDoc.getText(),
                    sourceDoc.getText(),
                );

                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    targetDoc.lineAt(0).range.start,
                    targetDoc.lineAt(targetDoc.lineCount - 1).range.end,
                );
                edit.replace(targetUri, fullRange, mergedContent);
                await vscode.workspace.applyEdit(edit);

                progress.report('Refreshing index');
                await vscode.workspace.fs.delete(newUri);
                indexService.removePage(newPath);
                try {
                    await reindexWorkspaceUri(targetUri, { indexService, indexScanner, notesRootPath });
                } catch { /* best effort */ }
                safeSaveToFile();
            });
        }
    }

    for (const { oldUri, newUri } of files) {
        if (isMarkdownUri(oldUri) && isMarkdownUri(newUri)) {
            const oldExt = path.extname(oldUri.fsPath);
            const newExt = path.extname(newUri.fsPath);
            const oldPageName = path.basename(oldUri.fsPath, oldExt);
            const newPageName = path.basename(newUri.fsPath, newExt);
            if (oldPageName !== newPageName) {
                linkRenames.push({ oldPageName, newPageName });
            }
        }
    }

    if (linkRenames.length === 0) { return; }

    const summary = linkRenames
        .map(r => `[[${r.oldPageName}]] → [[${r.newPageName}]]`)
        .join(', ');
    const rootUri = notesRootPath
        ? vscode.Uri.file(notesRootPath)
        : vscode.workspace.workspaceFolders?.[0]?.uri;
    const filenameRefactorPlan = rootUri && indexService.getAllPages
        ? collectFilenameRefactorOperations(
            linkRenames,
            indexService.getAllPages(),
            rootUri,
            {
                excludePaths: files.map(file => {
                    const uri = file.newUri;
                    return notesRootPath
                        ? toNotesRelativePath(notesRootPath, uri.fsPath)
                        : vscode.workspace.asRelativePath(uri, false);
                }),
            },
        )
        : { fileRenames: [], fileMerges: [] };
    const extraFilenameChanges = filenameRefactorPlan.fileRenames.length + filenameRefactorPlan.fileMerges.length;
    const msg = linkRenames.length === 1
        ? `Update all ${summary} references?${extraFilenameChanges > 0 ? ` Also update ${extraFilenameChanges} filename reference(s).` : ''}`
        : `Update references for ${linkRenames.length} renamed files? ${summary}${extraFilenameChanges > 0 ? ` Also update ${extraFilenameChanges} filename reference(s).` : ''}`;
    const choice = await vscode.window.showInformationMessage(msg, 'Yes', 'No');
    if (choice !== 'Yes') { return; }

    await withWikilinkRenameProgress('AS Notes: Updating wikilink references', async (progress) => {
        const candidateUris = rootUri
            ? indexService.findPagesLinkingToPageNames(linkRenames.map(rename => rename.oldPageName))
                .map(page => vscode.Uri.joinPath(rootUri, page.path))
            : [];

        progress.report('Preparing rename operations');
        for (const merge of filenameRefactorPlan.fileMerges) {
            const sourceDoc = await vscode.workspace.openTextDocument(merge.oldUri);
            const targetDoc = await vscode.workspace.openTextDocument(merge.newUri);

            const mergedContent = new FrontMatterService().mergeDocuments(
                targetDoc.getText(),
                sourceDoc.getText(),
            );

            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                targetDoc.lineAt(0).range.start,
                targetDoc.lineAt(targetDoc.lineCount - 1).range.end,
            );
            edit.replace(merge.newUri, fullRange, mergedContent);
            await vscode.workspace.applyEdit(edit);
            await vscode.workspace.fs.delete(merge.oldUri);
        }

        for (const rename of filenameRefactorPlan.fileRenames) {
            await vscode.workspace.fs.rename(rename.oldUri, rename.newUri, { overwrite: false });
        }

        const rewriteCandidateUris = remapUrisForFileOperations(
            candidateUris,
            filenameRefactorPlan.fileRenames,
            filenameRefactorPlan.fileMerges,
        );

        progress.report('Updating links across workspace');
        const affectedUris = await updateLinksInWorkspace(
            wikilinkService,
            linkRenames,
            rewriteCandidateUris.length > 0 ? { candidateUris: rewriteCandidateUris } : undefined,
        );

        progress.report('Refreshing index');
        for (const uri of affectedUris) {
            try {
                await reindexWorkspaceUri(uri, {
                    indexService,
                    indexScanner,
                    notesRootPath,
                });
            } catch { /* best effort */ }
        }
        for (const merge of filenameRefactorPlan.fileMerges) {
            const oldPath = notesRootPath
                ? toNotesRelativePath(notesRootPath, merge.oldUri.fsPath)
                : vscode.workspace.asRelativePath(merge.oldUri, false);
            indexService.removePage(oldPath);
            try {
                await reindexWorkspaceUri(merge.newUri, {
                    indexService,
                    indexScanner,
                    notesRootPath,
                });
            } catch { /* best effort */ }
        }
        for (const rename of filenameRefactorPlan.fileRenames) {
            const oldPath = notesRootPath
                ? toNotesRelativePath(notesRootPath, rename.oldUri.fsPath)
                : vscode.workspace.asRelativePath(rename.oldUri, false);
            indexService.removePage(oldPath);
            try {
                await reindexWorkspaceUri(rename.newUri, {
                    indexService,
                    indexScanner,
                    notesRootPath,
                });
            } catch { /* best effort */ }
        }
        if (safeSaveToFile()) {
            refreshProviders();
        }
    });
}
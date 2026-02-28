import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Handles file resolution, existence checking, and creation for wikilink targets.
 *
 * Target files are always resolved in the same directory as the source file
 * with a `.md` extension.
 *
 * File resolution is case-insensitive — on case-sensitive filesystems (Linux/macOS),
 * a directory scan finds existing files regardless of casing.
 */
export class WikilinkFileService {

    /**
     * Build the URI for a wikilink target file (exact-case).
     *
     * @param sourceUri - URI of the document containing the wikilink
     * @param pageFileName - Sanitised page filename (without extension)
     * @returns URI pointing to `{sourceDir}/{pageFileName}.md`
     */
    resolveTargetUri(sourceUri: vscode.Uri, pageFileName: string): vscode.Uri {
        const sourceDir = path.dirname(sourceUri.fsPath);
        const targetPath = path.join(sourceDir, `${pageFileName}.md`);
        return vscode.Uri.file(targetPath);
    }

    /**
     * Resolve the URI for a wikilink target, performing a case-insensitive
     * search in the source directory. If an existing file matches (ignoring case),
     * its actual URI is returned. Otherwise falls back to the exact-case URI.
     *
     * @param sourceUri - URI of the document containing the wikilink
     * @param pageFileName - Sanitised page filename (without extension)
     * @returns URI of the matching file (existing or exact-case fallback)
     */
    async resolveTargetUriCaseInsensitive(
        sourceUri: vscode.Uri,
        pageFileName: string,
    ): Promise<vscode.Uri> {
        const sourceDir = path.dirname(sourceUri.fsPath);
        const targetName = `${pageFileName}.md`;
        const exactUri = vscode.Uri.file(path.join(sourceDir, targetName));

        // Fast path: exact-case match (covers Windows/macOS HFS+ and correct-case links)
        if (await this.fileExists(exactUri)) {
            return exactUri;
        }

        // Slow path: case-insensitive directory scan (for case-sensitive filesystems)
        try {
            const dirUri = vscode.Uri.file(sourceDir);
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            const targetNameLower = targetName.toLowerCase();

            for (const [name] of entries) {
                if (name.toLowerCase() === targetNameLower) {
                    return vscode.Uri.file(path.join(sourceDir, name));
                }
            }
        } catch {
            // Directory read failed — fall through to exact-case URI
        }

        return exactUri;
    }

    /**
     * Navigate to a wikilink target file, creating it if it doesn't exist.
     * Uses case-insensitive resolution so `[[test]]` opens `Test.md` on
     * case-sensitive filesystems.
     *
     * @param targetUri - Exact-case URI of the target `.md` file (used as fallback for creation)
     * @param pageFileName - Display name for notifications
     * @param sourceUri - URI of the source document (for directory scanning)
     */
    async navigateToFile(
        targetUri: vscode.Uri,
        pageFileName: string,
        sourceUri?: vscode.Uri,
    ): Promise<void> {
        // Try case-insensitive resolution if we know the source directory
        let resolvedUri = targetUri;
        if (sourceUri) {
            resolvedUri = await this.resolveTargetUriCaseInsensitive(sourceUri, pageFileName);
        }

        const exists = await this.fileExists(resolvedUri);

        if (!exists) {
            // No case-insensitive match found — create with exact case from the wikilink
            await vscode.workspace.fs.writeFile(targetUri, new Uint8Array());
            vscode.window.showInformationMessage(`Created ${pageFileName}.md`);
            resolvedUri = targetUri;
        }

        const document = await vscode.workspace.openTextDocument(resolvedUri);
        await vscode.window.showTextDocument(document);
    }

    /**
     * Check whether a file exists at the given URI.
     */
    async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
}

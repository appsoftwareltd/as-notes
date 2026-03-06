/**
 * Programmatic workspace configuration for file drop/paste destinations.
 *
 * Instead of custom drop/paste providers, AS Notes configures the built-in
 * VS Code `markdown.copyFiles.destination` setting to route dropped/pasted
 * files to the user's configured asset path.
 */

import * as vscode from 'vscode';

/**
 * Apply (or remove) the `markdown.copyFiles.destination` workspace setting
 * so that VS Code's built-in markdown drop/paste places files in the
 * folder specified by `as-notes.assetPath`.
 *
 * Also cleans up legacy overrides (`markdown.editor.drop.enabled`,
 * `markdown.editor.filePaste.enabled`) that may have been written by
 * earlier versions of the extension.
 */
export async function applyAssetPathSettings(): Promise<void> {
    const assetPath = vscode.workspace
        .getConfiguration('as-notes')
        .get<string>('assetPath', 'assets/images');

    const target = vscode.ConfigurationTarget.Workspace;

    // Set the built-in markdown copy destination to our configured asset folder.
    // The glob key **/*.md means this applies to drops/pastes into any .md file.
    // ${fileName} is replaced by VS Code with the original filename of the
    // dropped/pasted file (preserving extension).
    // Leading "/" makes the destination relative to the workspace root rather
    // than relative to the document being edited.
    const mdConfig = vscode.workspace.getConfiguration('markdown');
    const destination: Record<string, string> = {
        '**/*.md': `/${assetPath}/\${fileName}`,
    };
    await mdConfig.update('copyFiles.destination', destination, target);

    // Clean up legacy overrides from previous extension versions that disabled
    // the built-in drop/paste providers entirely.
    const editorConfig = vscode.workspace.getConfiguration('markdown.editor');
    const dropEnabled = editorConfig.inspect('drop.enabled');
    if (dropEnabled?.workspaceValue !== undefined) {
        await editorConfig.update('drop.enabled', undefined, target);
    }
    const pasteEnabled = editorConfig.inspect('filePaste.enabled');
    if (pasteEnabled?.workspaceValue !== undefined) {
        await editorConfig.update('filePaste.enabled', undefined, target);
    }

    // Also clean up legacy copyIntoWorkspace overrides
    const dropCopy = editorConfig.inspect('drop.copyIntoWorkspace');
    if (dropCopy?.workspaceValue !== undefined) {
        await editorConfig.update('drop.copyIntoWorkspace', undefined, target);
    }
    const pasteCopy = editorConfig.inspect('filePaste.copyIntoWorkspace');
    if (pasteCopy?.workspaceValue !== undefined) {
        await editorConfig.update('filePaste.copyIntoWorkspace', undefined, target);
    }
}

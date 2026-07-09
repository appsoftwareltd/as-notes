/**
 * Copy a secret to the clipboard and clear it after a configurable delay, but
 * only if the clipboard still holds what we put there (so we never wipe
 * something the user copied afterwards).
 */

import * as vscode from 'vscode';

let clearTimer: NodeJS.Timeout | undefined;

export async function copyEphemeral(value: string, label: string): Promise<void> {
    await vscode.env.clipboard.writeText(value);

    const seconds = vscode.workspace
        .getConfiguration('as-notes.safe')
        .get<number>('clipboardClearSeconds', 30);

    if (clearTimer) {
        clearTimeout(clearTimer);
        clearTimer = undefined;
    }

    if (seconds > 0) {
        clearTimer = setTimeout(async () => {
            const current = await vscode.env.clipboard.readText();
            if (current === value) {
                await vscode.env.clipboard.writeText('');
            }
            clearTimer = undefined;
        }, seconds * 1000);
        void vscode.window.showInformationMessage(
            `AS Notes: ${label} copied to clipboard - clears in ${seconds}s.`,
        );
    } else {
        void vscode.window.showInformationMessage(`AS Notes: ${label} copied to clipboard.`);
    }
}

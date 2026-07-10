/**
 * SafeLockedViewProvider - the sidebar surface shown whenever the safe is not
 * unlocked: the Pro upsell, the "no safe set up yet" state, and the locked
 * state, which lays the safe path and key-file path out above the Unlock button.
 *
 * A webview rather than `viewsWelcome` because welcome `contents` are static
 * strings in package.json and so cannot show which .kdbx is about to be opened
 * or which key file is in play. Setting `TreeView.message` on the tree instead
 * would suppress the welcome buttons entirely.
 *
 * This webview receives file *paths* only - never the decrypted database, never
 * the master password, never key-file bytes. Unlocking still runs host-side off
 * the `as-notes.safe.unlock` command, which prompts with a VS Code input box.
 */

import * as vscode from 'vscode';
import { SafeSessionService } from './SafeSessionService';

/** What the webview needs to render. Paths only - no secrets. */
export interface LockedViewState {
    pro: boolean;
    safePath: string | null;
    /** The configured safe is not on disk (moved, or an unmounted drive). */
    safeMissing: boolean;
    keyFilePath: string | null;
    /** The configured key file is not on disk - unlock will fail until fixed. */
    keyFileMissing: boolean;
}

export class SafeLockedViewProvider implements vscode.WebviewViewProvider {
    static readonly VIEW_ID = 'as-notes-safe-locked';

    private view: vscode.WebviewView | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly session: SafeSessionService,
        private readonly isPro: () => boolean,
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
        webviewView.webview.html = this.renderHtml(webviewView.webview);
        void this.postState();

        // Re-stat the paths when the view is revealed: a key file on a USB stick
        // may have been plugged in or pulled out while the view was hidden.
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                void this.postState();
            }
        });
    }

    /** Re-render. Call when the safe/key-file path changes, or on lock/unlock. */
    refresh(): void {
        void this.postState();
    }

    private async postState(): Promise<void> {
        if (!this.view) {
            return;
        }
        const safePath = this.session.getSafePath() ?? null;
        const keyFilePath = this.session.getKeyFilePath() ?? null;
        const state: LockedViewState = {
            pro: this.isPro(),
            safePath,
            safeMissing: safePath ? !(await exists(safePath)) : false,
            keyFilePath,
            keyFileMissing: keyFilePath ? !(await exists(keyFilePath)) : false,
        };
        void this.view.webview.postMessage({ type: 'state', state });
    }

    /** Every action is an existing command, so the Pro gate in SafeFeature applies. */
    private handleMessage(msg: unknown): void {
        const type = (msg as { type?: string })?.type;
        const command = {
            unlock: 'as-notes.safe.unlock',
            create: 'as-notes.safe.create',
            selectSafe: 'as-notes.safe.selectFile',
            selectKeyFile: 'as-notes.safe.selectKeyFile',
            clearKeyFile: 'as-notes.safe.clearKeyFile',
            licence: 'as-notes.enterLicenceKey',
        }[type ?? ''];
        if (command) {
            void vscode.commands.executeCommand(command);
        }
    }

    private renderHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'safe-locked.js'),
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'safe-locked.css'),
        );
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.css'),
        );
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; font-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${codiconUri}">
    <link rel="stylesheet" href="${styleUri}">
    <title>KeePass Password Safe</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

async function exists(path: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(path));
        return true;
    } catch {
        return false;
    }
}

function getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
